using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// Centralized export / change-detection / import engine for the 9 exchangeable
/// domains. Rows export as NORMALIZED columns: document-store + JSON-payload
/// domains are flattened into dotted-key columns (see <see cref="JsonFlatten"/>)
/// rather than a single `payload_json` cell. Columns are therefore data-driven
/// (the union of flattened keys), not a fixed list.
///
/// Every export and apply writes one append-only audit row (DB_CONSTRAINTS §9).
/// The classification checksum is computed over a row's DATA columns only via
/// <see cref="RowChecksum"/>, recomputed on BOTH sides so offline cell edits are
/// detected even though the spreadsheet's checksum cell isn't touched.
/// </summary>
public sealed class DataExchangeService(
    AdminDbContext db,
    OperationalRecordsService records,
    IAuditSink auditSink,
    IChangeTrackingActorProvider actor,
    IHostEnvironment hostEnvironment)
{
    // Read/write doc-store domains through OperationalRecordsService — the facade
    // ApplicantsController uses. It routes `applicants` to the core dbo.applicants
    // projection and other modules to their normalized operational tables.

    private const string Module = "data-exchange";
    private const string ImportSource = "data-exchange-import";
    private const string AuditEntityType = "data-exchange";
    private const string DefaultExamScheduleTime = "08:00";

    private static readonly string[] TrackingColumns =
        ["created_at", "updated_at", "row_version", "last_modified_by", "source_system", "checksum"];

    private static readonly IReadOnlySet<string> NonDataColumns = new HashSet<string>(StringComparer.Ordinal)
    {
        "id", "business_key", "created_at", "updated_at", "row_version", "last_modified_by", "source_system", "checksum",
    };

    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    // ──────────────────────────────────────────────────────────────────────
    // EXPORT
    // ──────────────────────────────────────────────────────────────────────
    /// <summary>
    /// Legacy round-trip export — data-driven flattened columns + tracking/
    /// checksum columns so an exported sheet can be edited offline and
    /// re-imported with row-level change detection. Backs the import templates +
    /// reconciliation workflow. For the human-readable full-database snapshot
    /// download see <see cref="ExportSnapshotAsync"/>.
    /// </summary>
    public async Task<ExportResultDto> ExportAsync(
        IReadOnlyList<ExchangeDomain> domains, string layout, ExportFilter filter, CancellationToken ct)
    {
        var scopedFilter = filter with { CycleId = await ResolveCycleIdAsync(filter.CycleId, ct) };
        var sheets = new List<ExportSheetDto>();
        var total = 0;
        foreach (var domain in domains)
        {
            if (!DataExchangeRegistry.ByDomain.TryGetValue(domain, out var spec)) continue;
            var rows = ApplyFilter(spec, await LoadAsync(spec, scopedFilter.CycleId, ct), scopedFilter);
            var dataColumns = UnionDataColumns(rows);
            var columns = ComposeColumns(dataColumns);
            var rowDicts = rows.Select(r => ToFullDict(r, dataColumns)).ToList();
            total += rowDicts.Count;
            sheets.Add(new ExportSheetDto(spec.Domain.ToString(), spec.SheetName, spec.TitleAr, columns, rowDicts));
        }

        var watermark = DateTimeOffset.UtcNow;
        await EmitAuditAsync("export", $"تصدير {sheets.Count} ورقة · {total} صف", total, 0, 0, 0, 0, ct);
        return new ExportResultDto(layout, watermark.ToString("O", CultureInfo.InvariantCulture), total, sheets);
    }

    private static IReadOnlyList<LoadedRow> ApplyFilter(DomainSpec spec, IReadOnlyList<LoadedRow> rows, ExportFilter filter)
    {
        var dateScoped = filter.Kind switch
        {
            ExportFilterKind.ChangedAfter => rows.Where(r => filter.ChangedAfter is { } d && r.UpdatedAt >= d).ToList(),
            ExportFilterKind.ModifiedSinceCreation => rows.Where(r => r.UpdatedAt != r.CreatedAt).ToList(),
            ExportFilterKind.SinceLastExport => filter.LastExportAt is { } w
                ? rows.Where(r => r.UpdatedAt >= w).ToList() : rows,
            _ => rows,
        };
        if (LegacyCycleScopedDomains.Contains(spec.Domain) && !string.IsNullOrWhiteSpace(filter.CycleId))
        {
            dateScoped = dateScoped.Where(r => LoadedRowMatchesCycle(r, filter.CycleId)).ToList();
        }
        if (filter.NationalIds is { Count: > 0 } allow)
        {
            return dateScoped.Where(r => allow.Contains(r.BusinessKey)).ToList();
        }
        return dateScoped;
    }

    // Legacy round-trip cycle-owned config sheets: a row without a matching cycle is
    // intentionally excluded (legacy/no-cycle rows don't belong to a live export).
    // People-derived sheets (Applicants, Relatives, ExamResults, AcquaintanceDocs)
    // are deliberately NOT here — they are scoped leniently at load time so a
    // booked applicant is never silently dropped just because their record carries
    // a blank or stale cycle id. See IsApplicantInCycleScope / BelongsToDifferentCycle.
    private static readonly IReadOnlySet<ExchangeDomain> LegacyCycleScopedDomains = new HashSet<ExchangeDomain>
    {
        ExchangeDomain.Exams,
        ExchangeDomain.Committees,
        ExchangeDomain.AdmissionConditions,
        ExchangeDomain.ExamSchedules,
    };

    /// <summary>
    /// Curated full-database snapshot export. Each requested domain becomes one
    /// sheet with a FIXED, ordered, human-readable column set (see
    /// <see cref="CuratedSheets"/>) — no flattened dotted keys, no checksum /
    /// row_version noise, no cross-cycle leakage. Empty domains still emit the
    /// header row. Cycle-scoped sheets are filtered to the resolved cycle;
    /// person-scoped sheets honor the admin's national-id allow-list. The
    /// frontend builds the leading <c>ExportInfo</c> sheet from
    /// <see cref="ExportResultDto.Info"/>.
    /// </summary>
    public async Task<ExportResultDto> ExportSnapshotAsync(
        IReadOnlyList<ExchangeDomain> domains, string layout, ExportFilter filter, CancellationToken ct)
    {
        var cycleId = await ResolveCycleIdAsync(filter.CycleId, ct);
        var scopedFilter = filter with { CycleId = cycleId };
        var requested = new HashSet<ExchangeDomain>(domains);
        var ctx = await BuildCuratedContextAsync(cycleId, ct);

        var sheets = new List<ExportSheetDto>();
        var total = 0;
        foreach (var spec in CuratedSheets)
        {
            if (!requested.Contains(spec.Domain)) continue;
            var loaded = await LoadCuratedAsync(spec, cycleId, ctx, ct);
            var rows = ApplyCuratedFilter(spec, loaded, scopedFilter);
            var rowDicts = rows.Select(r => Project(spec, r)).ToList();
            total += rowDicts.Count;
            sheets.Add(new ExportSheetDto(spec.Domain.ToString(), spec.SheetName, spec.TitleAr, spec.Columns, rowDicts));
        }

        var watermark = DateTimeOffset.UtcNow;
        var info = await BuildExportInfoAsync(cycleId, watermark, ct);
        await EmitAuditAsync("export", $"تصدير {sheets.Count} ورقة · {total} صف", total, 0, 0, 0, 0, ct);
        return new ExportResultDto(layout, watermark.ToString("O", CultureInfo.InvariantCulture), total, sheets, info);
    }

    /// <summary>Applies the date / watermark filter and the person-scoped
    /// national-id allow-list to a curated sheet's rows. Cycle scoping is done
    /// inside each loader (so legacy / blank-cycle rows are handled per-domain).</summary>
    private static IReadOnlyList<CuratedRow> ApplyCuratedFilter(
        CuratedSheetSpec spec, IReadOnlyList<CuratedRow> rows, ExportFilter filter)
    {
        var dateScoped = filter.Kind switch
        {
            ExportFilterKind.ChangedAfter => rows.Where(r => filter.ChangedAfter is { } d && r.UpdatedAt >= d).ToList(),
            ExportFilterKind.ModifiedSinceCreation => rows.Where(r => r.UpdatedAt != r.CreatedAt).ToList(),
            ExportFilterKind.SinceLastExport => filter.LastExportAt is { } w
                ? rows.Where(r => r.UpdatedAt >= w).ToList() : rows.ToList(),
            _ => rows.ToList(),
        };
        if (spec.PersonScoped && filter.NationalIds is { Count: > 0 } allow)
        {
            return dateScoped.Where(r => r.PersonKey is not null && allow.Contains(r.PersonKey)).ToList();
        }
        return dateScoped;
    }

    /// <summary>Maps a curated row's cells onto the sheet's fixed column order,
    /// filling absent columns with null (so the grid never misaligns).</summary>
    private static IReadOnlyDictionary<string, string?> Project(CuratedSheetSpec spec, CuratedRow row)
    {
        var dict = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var col in spec.Columns)
            dict[col] = row.Cells.TryGetValue(col, out var v) ? Clean(v) : null;
        return dict;
    }

    /// <summary>Normalizes a cell to a clean, single-line string (trims, collapses
    /// CR/LF/tabs) so multi-line JSON-derived values never break the grid.</summary>
    private static string? Clean(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return raw;
        var s = raw.Replace("\r", " ").Replace("\n", " ").Replace("\t", " ").Trim();
        return s.Length == 0 ? null : s;
    }

    // ──────────────────────────────────────────────────────────────────────
    // ROSTER (booked applicants — drives the selectable export list)
    // ──────────────────────────────────────────────────────────────────────
    /// <summary>
    /// Lists the applicants currently eligible for export — those who have
    /// booked the first exam appointment (`IsApplicantBooked` true). Projects
    /// the identity columns the admin selects against on the data-exchange
    /// page. Reads through <see cref="OperationalRecordsService.ListAsync"/>;
    /// no mock fallback.
    /// </summary>
    public async Task<IReadOnlyList<ApplicantRosterRow>> ListBookedApplicantsAsync(string? cycleId, CancellationToken ct)
    {
        IReadOnlyList<JsonObject> payloads;
        // Skip list-level committee enrichment — this method resolves committee
        // names itself against the directory + instances it loads below.
        try { payloads = await records.ListAsync("applicants", enrichApplicantCommitteeNames: false, ct); }
        catch (InvalidOperationException) { return []; }

        var resolvedCycleId = await ResolveCycleIdAsync(cycleId, ct);
        var activeCategoryKeys = await LoadCycleCategoryKeysAsync(resolvedCycleId, ct);
        var committeeDirectory = await records.LoadCommitteeDirectoryAsync(ct);
        var committeeInstances = await LoadCommitteeInstancesAsync(ct);

        var roster = new List<ApplicantRosterRow>(payloads.Count);
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            if (!IsApplicantInCycleScope(payload, resolvedCycleId, activeCategoryKeys)) continue;
            if (!IsApplicantBooked(payload)) continue;

            var slot = payload["examSlot"] as JsonObject;
            var nid = payload["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue; // roster keys on NID

            roster.Add(new ApplicantRosterRow(
                NationalId: nid,
                ApplicantId: payload["id"]?.ToString() ?? nid,
                FullName: payload["fullName"]?.ToString() ?? payload["name"]?.ToString(),
                Gender: payload["gender"]?.ToString(),
                Status: payload["status"]?.ToString(),
                ExamSlotDate: slot?["date"]?.ToString(),
                ExamSlotTime: slot?["time"]?.ToString(),
                CommitteeName: OperationalRecordsService.ResolveCommitteeName(payload, committeeDirectory, committeeInstances),
                ExamSlotLocation: slot?["location"]?.ToString(),
                UpdatedAt: ParseDto(payload["updatedAt"] ?? payload["updated_at"])));
        }
        return roster
            .OrderBy(r => r.ExamSlotDate ?? string.Empty, StringComparer.Ordinal)
            .ThenBy(r => r.FullName ?? string.Empty, StringComparer.Ordinal)
            .ToList();
    }

    private async Task<IReadOnlyList<JsonObject>> LoadCommitteeInstancesAsync(CancellationToken ct)
    {
        try { return await records.ListAsync("committeeInstances", ct); }
        catch (InvalidOperationException) { return []; }
    }

    private static string? FirstString(JsonObject payload, params string[] keys)
    {
        foreach (var key in keys)
        {
            var text = AdminRecordJson.StringProp(payload, key);
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }
        return null;
    }

    private static string? NestedStringProp(JsonObject payload, string parentKey, string childKey)
        => payload.TryGetPropertyValue(parentKey, out var node) && node is JsonObject child
            ? AdminRecordJson.StringProp(child, childKey)
            : null;

    private static bool TextEquals(string? left, string? right)
        => !string.IsNullOrWhiteSpace(left) &&
            !string.IsNullOrWhiteSpace(right) &&
            string.Equals(left, right, StringComparison.OrdinalIgnoreCase);

    private static string? DateKey(string? rawDate)
        => string.IsNullOrWhiteSpace(rawDate) ? null : rawDate.Length >= 10 ? rawDate[..10] : rawDate;

    // ──────────────────────────────────────────────────────────────────────
    // RECONCILIATION (applicants — field-level diff + result writeback)
    // ──────────────────────────────────────────────────────────────────────

    /// <summary>Editable applicant fields the admin may correct via the
    /// round-trip Excel. Anything outside this set is ignored during diff
    /// (system / identity / writeback / read-only columns).</summary>
    private static readonly IReadOnlySet<string> EditableApplicantFields = new HashSet<string>(StringComparer.Ordinal)
    {
        "fullName", "name", "gender", "phoneNumber", "mobile", "email",
        "religion", "birthDate", "birthGovernorate", "birthDistrict",
        "maritalStatus", "governorate", "city",
        "address.governorate", "address.city", "address.detail", "address.street",
    };

    /// <summary>Reserved writeback columns — parsed into ApplicantWritebackResult,
    /// never diffed as a regular field.</summary>
    private static readonly IReadOnlySet<string> WritebackColumns = new HashSet<string>(StringComparer.Ordinal)
    {
        "result", "next_exam_date", "round", "test_code",
    };

    /// <summary>Computes the per-applicant field diff for a parsed Applicants
    /// sheet. Writes nothing; the admin chooses which fields to accept on the
    /// commit endpoint. Unmatched national IDs are surfaced rather than
    /// silently dropped.</summary>
    public async Task<ApplicantReconciliationPreview> PreviewApplicantsReconciliationAsync(
        ImportSheetInput sheet, CancellationToken ct)
    {
        var booked = await LoadBookedApplicantsByNidAsync(null, ct);
        var resultLookup = await LoadResultLookupAsync(ct);
        var rows = new List<ApplicantReconciliationRow>(sheet.Rows.Count);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < sheet.Rows.Count; i++)
        {
            var importRow = sheet.Rows[i];
            var nid = Get(importRow, "nationalId") ?? Get(importRow, "business_key") ?? "";
            var errors = new List<string>();
            if (string.IsNullOrWhiteSpace(nid))
            {
                errors.Add("الرقم القومي مفقود");
                rows.Add(new ApplicantReconciliationRow("", null, null, true, [], null, errors));
                continue;
            }
            if (!seen.Add(nid))
            {
                errors.Add("مفتاح مكرر داخل الملف");
                rows.Add(new ApplicantReconciliationRow(nid, null, null, false, [], null, errors));
                continue;
            }

            var writeback = ParseWritebackResult(importRow, resultLookup);
            if (!booked.TryGetValue(nid, out var payload))
            {
                rows.Add(new ApplicantReconciliationRow(
                    nid, null, Get(importRow, "fullName") ?? Get(importRow, "name"),
                    true, [], writeback, ["APPLICANT_NID_UNMATCHED"]));
                continue;
            }

            var diffs = ComputeFieldDiffs(payload, importRow);
            rows.Add(new ApplicantReconciliationRow(
                nid,
                payload["id"]?.ToString() ?? nid,
                payload["fullName"]?.ToString() ?? payload["name"]?.ToString(),
                false, diffs, writeback, errors));
        }

        var counts = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["total"] = rows.Count,
            ["matched"] = rows.Count(r => !r.Unmatched),
            ["unmatched"] = rows.Count(r => r.Unmatched),
            ["withDiff"] = rows.Count(r => r.FieldDiffs.Count > 0),
            ["withWriteback"] = rows.Count(r => r.Writeback?.Outcome is not null),
            ["invalid"] = rows.Count(r => r.Errors.Count > 0 && r.Errors.All(e => e != "APPLICANT_NID_UNMATCHED")),
        };
        return new ApplicantReconciliationPreview(counts, rows);
    }

    /// <summary>Computes the diff for one applicant row. Only fields in
    /// <see cref="EditableApplicantFields"/> are considered, only when the
    /// imported cell has a non-null value AND differs from the live DB.</summary>
    private static IReadOnlyList<ApplicantFieldDiff> ComputeFieldDiffs(
        JsonObject dbPayload, IReadOnlyDictionary<string, string?> importRow)
    {
        var dbFlat = JsonFlatten.Flatten(dbPayload).ToDictionary(p => p.Key, p => p.Value, StringComparer.Ordinal);
        var diffs = new List<ApplicantFieldDiff>();
        foreach (var (field, importedRaw) in importRow)
        {
            if (!EditableApplicantFields.Contains(field)) continue;
            if (NonDataColumns.Contains(field)) continue;
            if (WritebackColumns.Contains(field)) continue;
            var imported = importedRaw?.Trim();
            if (string.IsNullOrEmpty(imported)) continue;
            var current = dbFlat.TryGetValue(field, out var v) ? (v ?? "") : "";
            if (string.Equals(current.Trim(), imported, StringComparison.Ordinal)) continue;
            diffs.Add(new ApplicantFieldDiff(field, current, imported));
        }
        return diffs;
    }

    /// <summary>Resolves the imported `result` cell (and round/test_code/
    /// next_exam_date siblings) into an ApplicantWritebackResult. Result codes
    /// resolve via the `test-results` lookup. Returns a writeback with all
    /// nulls when no result column was supplied.</summary>
    private static ApplicantWritebackResult ParseWritebackResult(
        IReadOnlyDictionary<string, string?> row,
        IReadOnlyDictionary<string, string> resultLookup)
    {
        var raw = Get(row, "result");
        var testCode = Get(row, "test_code");
        var nextExamDate = Get(row, "next_exam_date");
        var roundRaw = Get(row, "round");
        int? round = int.TryParse(roundRaw, out var r) ? r : null;
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(raw))
        {
            return new ApplicantWritebackResult(raw, null, testCode, round, nextExamDate, errors);
        }

        var trimmed = raw.Trim();
        if (!resultLookup.TryGetValue(trimmed, out var outcome))
        {
            errors.Add("RESULT_VALUE_UNKNOWN");
            return new ApplicantWritebackResult(raw, null, testCode, round, nextExamDate, errors);
        }

        // Passed applicants must carry a next-exam date (admin-supplied via file)
        // unless this is the terminal round — leave date-presence enforcement to
        // the commit endpoint, which knows the cycle's follow-up plan length.
        if (string.Equals(outcome, "passed", StringComparison.Ordinal)
            && string.IsNullOrWhiteSpace(nextExamDate))
        {
            errors.Add("WRITEBACK_NEXT_EXAM_MISSING");
        }
        return new ApplicantWritebackResult(raw, outcome, testCode, round, nextExamDate, errors);
    }

    /// <summary>Booked applicants indexed by nationalId, used as the diff base.
    /// Mirrors LoadDocStoreAsync's eligibility gate (only booked applicants
    /// participate in reconciliation).</summary>
    private async Task<IReadOnlyDictionary<string, JsonObject>> LoadBookedApplicantsByNidAsync(string? cycleId, CancellationToken ct)
    {
        IReadOnlyList<JsonObject> payloads;
        try { payloads = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return new Dictionary<string, JsonObject>(); }
        var resolvedCycleId = await ResolveCycleIdAsync(cycleId, ct);
        var activeCategoryKeys = await LoadCycleCategoryKeysAsync(resolvedCycleId, ct);
        var map = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            if (!IsApplicantInCycleScope(payload, resolvedCycleId, activeCategoryKeys)) continue;
            if (!IsApplicantBooked(payload)) continue;
            var nid = payload["nationalId"]?.ToString();
            if (!string.IsNullOrWhiteSpace(nid)) map[nid] = payload;
        }
        return map;
    }

    /// <summary>Loads the `test-results` lookup once per request; returns a
    /// reverse-map from every accepted phrasing (code, Arabic name, English
    /// outcome) → canonical FollowUpOutcomes value.</summary>
    private async Task<IReadOnlyDictionary<string, string>> LoadResultLookupAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "test-results").ToListAsync(ct);
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            // payload carries `outcome` (`pass|fail|defer|withdrawn`) per lookups.mock
            var payload = AdminRecordJson.Parse(row.PayloadJson);
            var outcome = payload["outcome"]?.ToString();
            if (string.IsNullOrWhiteSpace(outcome)) continue;
            var canonical = MapOutcomeToFollowUp(outcome);
            map[row.Code] = canonical;
            map[row.Name] = canonical;
            map[outcome] = canonical;
            map[canonical] = canonical;
        }
        if (map.Count > 0)
        {
            map.TryAdd("ناجح", "passed");
            map.TryAdd("راسب", "failed");
            map.TryAdd("pass", "passed");
            map.TryAdd("fail", "failed");
        }
        return map;
    }

    private static string MapOutcomeToFollowUp(string outcome) => outcome switch
    {
        "pass" => "passed",
        "fail" => "failed",
        "defer" => "in-progress",
        "withdrawn" => "failed",
        _ => outcome,
    };

    /// <summary>Commits the admin's reconciliation decisions for an Applicants
    /// sheet: writes only the accepted field-level corrections plus (per
    /// decision) the round result / next-exam-date writeback. Per-applicant
    /// partial semantics — one failing applicant does NOT block the others.
    /// Result writeback follows the existing portal contract: round result is
    /// patched into `followUp[testCode]` (the same key Stage-10 reads), and
    /// `examSlot.date` is updated to the next-round date for passed applicants.
    /// </summary>
    public async Task<ApplicantReconciliationCommitResult> CommitApplicantsReconciliationAsync(
        ApplicantReconciliationCommitRequest request, CancellationToken ct)
    {
        if (!string.Equals(request.Sheet.SheetName, "Applicants", StringComparison.Ordinal))
            throw new InvalidOperationException("ورقة الاعتماد يجب أن تكون «Applicants».");

        // Re-resolve diffs against the LIVE db so a concurrent edit (since the
        // admin's preview) cannot be overwritten without a fresh preview.
        var preview = await PreviewApplicantsReconciliationAsync(request.Sheet, ct);
        var rowByNid = preview.Rows.ToDictionary(r => r.NationalId, r => r, StringComparer.Ordinal);
        var importByNid = request.Sheet.Rows
            .Where(r => !string.IsNullOrWhiteSpace(Get(r, "nationalId")))
            .ToDictionary(r => Get(r, "nationalId")!, r => r, StringComparer.Ordinal);

        var attempted = 0; var successCount = 0; var fieldsWritten = 0; var writebacksApplied = 0;
        var failed = new List<ImportFailedRow>();

        for (var i = 0; i < request.Decisions.Count; i++)
        {
            var decision = request.Decisions[i];
            attempted++;
            if (!rowByNid.TryGetValue(decision.NationalId, out var diffRow) || diffRow.Unmatched)
            {
                failed.Add(new ImportFailedRow(i, request.Sheet.SheetName, ["APPLICANT_NID_UNMATCHED"]));
                continue;
            }
            if (!importByNid.TryGetValue(decision.NationalId, out var importRow))
            {
                failed.Add(new ImportFailedRow(i, request.Sheet.SheetName, ["IMPORT_ROW_MISSING"]));
                continue;
            }

            try
            {
                var (fields, writeback) = await ApplyOneAsync(diffRow, importRow, decision, ct);
                fieldsWritten += fields;
                if (writeback) writebacksApplied++;
                successCount++;
            }
            catch (Exception ex)
            {
                failed.Add(new ImportFailedRow(i, request.Sheet.SheetName, [ex.Message]));
            }
        }

        await EmitAuditAsync("reconcile",
            $"اعتماد {successCount} متقدم · {fieldsWritten} حقل · {writebacksApplied} نتيجة",
            attempted, 0, successCount, 0, failed.Count, ct);

        return new ApplicantReconciliationCommitResult(
            attempted, successCount, fieldsWritten, writebacksApplied, failed.Count, failed);
    }

    /// <summary>Applies one applicant's accepted-field set and (optional) result
    /// writeback. Patches the live applicant payload through
    /// `OperationalRecordsService.UpsertAsync` so the audit sink fires and any
    /// concurrent update path stays consistent. Idempotent per round —
    /// re-importing the same round overwrites `followUp[testCode]` in place.</summary>
    private async Task<(int FieldsWritten, bool WritebackApplied)> ApplyOneAsync(
        ApplicantReconciliationRow diff,
        IReadOnlyDictionary<string, string?> importRow,
        ApplicantReconciliationDecision decision,
        CancellationToken ct)
    {
        var payload = await records.GetAsync("applicants", diff.ApplicantId ?? diff.NationalId, ct);
        if (payload is null)
        {
            // Fallback: search by nationalId across the bucket since some seed
            // paths set the record id to the GUID, not the NID.
            var byNid = await LoadBookedApplicantsByNidAsync(null, ct);
            if (!byNid.TryGetValue(diff.NationalId, out payload))
                throw new InvalidOperationException("APPLICANT_NID_UNMATCHED");
        }

        var workingPayload = payload.DeepClone().AsObject();
        var fieldsWritten = 0;
        var writebackApplied = false;

        // 1. Field-level corrections — accepted diffs only.
        foreach (var diffEntry in diff.FieldDiffs)
        {
            if (!decision.AcceptedFields.Contains(diffEntry.Field)) continue;
            var newValue = importRow.TryGetValue(diffEntry.Field, out var v) ? v : null;
            SetFlattenedPath(workingPayload, diffEntry.Field, newValue);
            fieldsWritten++;
        }

        // 2. Result + next-exam writeback — only when admin opted in AND the
        // writeback parsed cleanly (no RESULT_VALUE_UNKNOWN).
        if (decision.ApplyWriteback
            && diff.Writeback?.Outcome is { } outcome
            && !diff.Writeback.Errors.Contains("RESULT_VALUE_UNKNOWN"))
        {
            var followUp = workingPayload["followUp"] as JsonObject ?? new JsonObject();
            var testCode = diff.Writeback.TestCode ?? "TST-01";
            followUp[testCode] = outcome;
            workingPayload["followUp"] = followUp;

            // Passed → schedule the next round's slot date in examSlot.date so
            // the applicant portal Stage-10 follow-up table picks it up.
            if (string.Equals(outcome, "passed", StringComparison.Ordinal)
                && !string.IsNullOrWhiteSpace(diff.Writeback.NextExamDate))
            {
                var slot = workingPayload["examSlot"] as JsonObject ?? new JsonObject();
                slot["date"] = diff.Writeback.NextExamDate;
                workingPayload["examSlot"] = slot;
            }
            writebackApplied = true;
        }

        if (fieldsWritten == 0 && !writebackApplied) return (0, false);

        workingPayload["id"] ??= diff.ApplicantId ?? diff.NationalId;
        workingPayload["sourceSystem"] = ImportSource;
        await records.UpsertAsync("applicants", workingPayload["id"]!.ToString(), workingPayload, ct);
        return (fieldsWritten, writebackApplied);
    }

    /// <summary>Sets a dotted-path key on a JsonObject, creating intermediate
    /// JsonObjects as needed. Mirrors `JsonFlatten.Unflatten`'s SetPath logic
    /// but for a single key — keeps the existing payload's type-safe shape.</summary>
    private static void SetFlattenedPath(JsonObject root, string path, string? value)
    {
        var parts = path.Split('.');
        JsonObject node = root;
        for (var i = 0; i < parts.Length - 1; i++)
        {
            if (node[parts[i]] is JsonObject child) { node = child; }
            else { var fresh = new JsonObject(); node[parts[i]] = fresh; node = fresh; }
        }
        node[parts[^1]] = value;
    }

    // ──────────────────────────────────────────────────────────────────────
    // PREVIEW (stateless / read-only)
    // ──────────────────────────────────────────────────────────────────────
    public async Task<ImportPreviewResult> PreviewAsync(ImportPreviewRequest request, CancellationToken ct)
    {
        var outcomes = new List<ImportRowOutcome>();
        var sheetIssues = new List<SheetIssue>();

        foreach (var sheet in request.Sheets)
        {
            if (!DataExchangeRegistry.BySheetName.TryGetValue(sheet.SheetName, out var spec))
            {
                sheetIssues.Add(new SheetIssue(sheet.SheetName, "DATA_EXCHANGE_INVALID_WORKBOOK",
                    $"اسم ورقة غير معروف: {sheet.SheetName}"));
                continue;
            }
            outcomes.AddRange((await ClassifySheetAsync(spec, sheet, ct)).Outcomes);
        }

        var counts = Enum.GetValues<ImportRowClass>().ToDictionary(Camel, c => outcomes.Count(o => o.Class == Camel(c)));
        return new ImportPreviewResult(counts, outcomes, sheetIssues);
    }

    private async Task<(List<ImportRowOutcome> Outcomes, IReadOnlyList<string> DataColumns, Dictionary<string, List<LoadedRow>> DbByKey)>
        ClassifySheetAsync(DomainSpec spec, ImportSheetInput sheet, CancellationToken ct)
    {
        var dbRows = await LoadAsync(spec, null, ct);
        var dbByKey = dbRows.GroupBy(r => r.BusinessKey, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        // Data columns = union of DB data keys + every imported (non-tracking) header.
        var dataColumns = dbRows.SelectMany(r => r.Data.Keys)
            .Concat(sheet.Rows.SelectMany(r => r.Keys).Where(k => !NonDataColumns.Contains(k)))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();
        var checksumColumns = new[] { "business_key" }.Concat(dataColumns).ToArray();

        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var outcomes = new List<ImportRowOutcome>(sheet.Rows.Count);

        for (var i = 0; i < sheet.Rows.Count; i++)
        {
            var row = sheet.Rows[i];
            var (bk, errors) = ResolveBusinessKey(spec, row);

            if (errors.Count > 0) { outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Invalid, errors.ToArray())); continue; }
            if (!seenKeys.Add(bk)) { outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Invalid, "مفتاح مكرر داخل الملف")); continue; }

            if (!dbByKey.TryGetValue(bk, out var matches) || matches.Count == 0)
            { outcomes.Add(Outcome(spec, i, bk, ImportRowClass.New)); continue; }
            if (matches.Count > 1)
            { outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Conflict, "المفتاح يطابق أكثر من صف")); continue; }

            var dbRow = matches[0];
            var dbChecksum = ChecksumOf(dbRow, checksumColumns);
            var importChecksum = RowChecksum.Compute(
                checksumColumns.Select(c => new KeyValuePair<string, object?>(c, ValueFor(c, bk, row))));

            if (string.Equals(dbChecksum, importChecksum, StringComparison.Ordinal))
            { outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Skipped)); continue; }

            outcomes.Add(Outcome(spec, i, bk, IsDbNewer(dbRow, row) ? ImportRowClass.Outdated : ImportRowClass.Changed));
        }

        return (outcomes, dataColumns, dbByKey);
    }

    private static object? ValueFor(string column, string businessKey, IReadOnlyDictionary<string, string?> row)
        => column == "business_key" ? businessKey : (row.TryGetValue(column, out var v) ? v : null);

    private static string ChecksumOf(LoadedRow row, IReadOnlyList<string> checksumColumns)
        => RowChecksum.Compute(checksumColumns.Select(c =>
            new KeyValuePair<string, object?>(c, c == "business_key" ? row.BusinessKey : (row.Data.TryGetValue(c, out var v) ? v : null))));

    private static bool IsDbNewer(LoadedRow dbRow, IReadOnlyDictionary<string, string?> importRow)
    {
        if (importRow.TryGetValue("row_version", out var rvRaw) && TryDecodeRowVersion(rvRaw, out var imported))
        {
            var cmp = CompareRowVersion(dbRow.RowVersion, imported);
            if (cmp != 0) return cmp > 0;
        }
        if (importRow.TryGetValue("updated_at", out var uaRaw)
            && DateTimeOffset.TryParse(uaRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var importedUpdated))
            return dbRow.UpdatedAt > importedUpdated;
        return false;
    }

    private static ImportRowOutcome Outcome(DomainSpec spec, int i, string bk, ImportRowClass cls, params string[] errors)
        => new(spec.Domain.ToString(), spec.SheetName, i, bk, Camel(cls), errors);

    private static string Camel(ImportRowClass c) => char.ToLowerInvariant(c.ToString()[0]) + c.ToString()[1..];

    // ──────────────────────────────────────────────────────────────────────
    // APPLY (transactional)
    // ──────────────────────────────────────────────────────────────────────
    public async Task<ImportApplyResult> ApplyAsync(ImportApplyRequest request, CancellationToken ct)
    {
        var applyChanged = string.Equals(request.Mode, "new-and-changed", StringComparison.OrdinalIgnoreCase);
        var attempted = 0; var inserted = 0; var updated = 0; var skipped = 0;
        var failed = new List<ImportFailedRow>();

        await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            foreach (var sheet in request.Sheets)
            {
                if (!DataExchangeRegistry.BySheetName.TryGetValue(sheet.SheetName, out var spec))
                { failed.Add(new ImportFailedRow(-1, sheet.SheetName, ["اسم ورقة غير معروف"])); continue; }

                var (outcomes, _, dbByKey) = await ClassifySheetAsync(spec, sheet, ct);
                for (var i = 0; i < sheet.Rows.Count; i++)
                {
                    var outcome = outcomes[i];
                    var row = sheet.Rows[i];
                    attempted++;
                    var existing = dbByKey.TryGetValue(outcome.BusinessKey, out var m) && m.Count == 1 ? m[0] : null;

                    switch (outcome.Class)
                    {
                        case "new": await UpsertAsync(spec, row, existing, ct); inserted++; break;
                        case "changed" when applyChanged: await UpsertAsync(spec, row, existing, ct); updated++; break;
                        case "outdated" when request.ForceUpdate: await UpsertAsync(spec, row, existing, ct); updated++; break;
                        case "invalid": failed.Add(new ImportFailedRow(i, sheet.SheetName, outcome.Errors)); break;
                        case "conflict" when !request.SkipConflicts: failed.Add(new ImportFailedRow(i, sheet.SheetName, ["تعارض — لم يُطبَّق"])); break;
                        default: skipped++; break;
                    }
                }
            }

            await db.SaveChangesAsync(ct);
            if (tx is not null) await tx.CommitAsync(ct);
        }
        catch
        {
            if (tx is not null) await tx.RollbackAsync(ct);
            throw;
        }

        await EmitAuditAsync("import", $"استيراد · {inserted} إضافة · {updated} تحديث", attempted, inserted, updated, skipped, failed.Count, ct);
        return new ImportApplyResult(attempted, inserted + updated, inserted, updated, skipped, failed.Count, failed);
    }

    // ──────────────────────────────────────────────────────────────────────
    // HISTORY + TEMPLATES
    // ──────────────────────────────────────────────────────────────────────
    public async Task<IReadOnlyList<HistoryEntryDto>> HistoryAsync(CancellationToken ct)
    {
        var rows = await db.AuditRows.AsNoTracking()
            .Where(x => x.Module == Module).OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync(ct);
        return rows.Select(x =>
        {
            JsonObject? d = null;
            try { d = JsonNode.Parse(x.Details) as JsonObject; } catch (JsonException) { /* tolerate legacy */ }
            int Num(string k) => d?[k]?.GetValue<int>() ?? 0;
            return new HistoryEntryDto(x.Id, x.Action, x.ActorName,
                d?["message"]?.GetValue<string>() ?? x.Details,
                Num("total"), Num("inserted"), Num("updated"), Num("skipped"), Num("failed"), x.CreatedAt);
        }).ToList();
    }

    public async Task<TemplateDto> TemplateAsync(DomainSpec spec, CancellationToken ct)
    {
        var rows = await LoadAsync(spec, null, ct);
        return new TemplateDto(spec.Domain.ToString(), spec.SheetName, spec.TitleAr, ComposeColumns(UnionDataColumns(rows)));
    }

    public DateTimeOffset? LastExportWatermark(CancellationToken ct)
        => db.AuditRows.AsNoTracking()
            .Where(x => x.Module == Module && x.Action == "export")
            .OrderByDescending(x => x.CreatedAt).Select(x => (DateTimeOffset?)x.CreatedAt).FirstOrDefault();

    // ──────────────────────────────────────────────────────────────────────
    // COLUMN COMPOSITION
    // ──────────────────────────────────────────────────────────────────────
    private static List<string> ComposeColumns(IReadOnlyList<string> dataColumns)
        => new[] { "id", "business_key" }.Concat(dataColumns).Concat(TrackingColumns).ToList();

    private static IReadOnlyList<string> UnionDataColumns(IReadOnlyList<LoadedRow> rows)
        => rows.SelectMany(r => r.Data.Keys).Distinct(StringComparer.Ordinal).OrderBy(c => c, StringComparer.Ordinal).ToList();

    private IReadOnlyDictionary<string, string?> ToFullDict(LoadedRow r, IReadOnlyList<string> dataColumns)
    {
        var dict = new Dictionary<string, string?>(StringComparer.Ordinal) { ["id"] = r.Id, ["business_key"] = r.BusinessKey };
        foreach (var col in dataColumns) dict[col] = r.Data.TryGetValue(col, out var v) ? v : null;
        dict["created_at"] = r.CreatedAt.ToString("O", CultureInfo.InvariantCulture);
        dict["updated_at"] = r.UpdatedAt.ToString("O", CultureInfo.InvariantCulture);
        dict["row_version"] = r.RowVersion.Length == 0 ? "" : Convert.ToBase64String(r.RowVersion);
        dict["last_modified_by"] = r.LastModifiedBy;
        dict["source_system"] = r.SourceSystem;
        dict["checksum"] = ChecksumOf(r, new[] { "business_key" }.Concat(dataColumns).ToArray());
        return dict;
    }

    // ──────────────────────────────────────────────────────────────────────
    // READ → LoadedRow (Data already holds the normalized data columns)
    // ──────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<LoadedRow>> LoadAsync(DomainSpec spec, string? cycleId, CancellationToken ct) => spec.Domain switch
    {
        // Domain-specific loaders for sheets whose data lives nested in another
        // bucket — registry's `module=relatives|acquaintance|examResults` rows
        // are empty in production because the data physically lives elsewhere:
        //   - Relatives  → nested in applicant.family.{father,mother,siblings,…}
        //   - ExamResults → nested in applicant.followUp[TST-NN]
        //   - AcquaintanceDocs → dedicated `applicant_acquaintance_docs` table
        ExchangeDomain.Relatives => await LoadApplicantRelativesAsync(cycleId, ct),
        ExchangeDomain.ExamResults => await LoadApplicantExamResultsAsync(cycleId, ct),
        ExchangeDomain.AcquaintanceDocs => await LoadAcquaintanceDocsAsync(cycleId, ct),
        _ => spec.Storage switch
        {
            ExchangeStorage.DocStore => await LoadDocStoreAsync(spec, cycleId, ct),
            ExchangeStorage.Lookups => await LoadLookupsAsync(ct),
            ExchangeStorage.AdmissionRules => await LoadAdmissionConditionsAsync(cycleId, ct),
            ExchangeStorage.Exams => await LoadExamsAsync(cycleId, ct),
            ExchangeStorage.ExamSlots => await LoadExamSchedulesAsync(cycleId, ct),
            _ => [],
        },
    };

    /// <summary>Top-level branches of the applicant payload that have their
    /// OWN dedicated sheets — pruned from the flattened Applicants row so the
    /// sheet stays focused on the applicant proper (no `family.father.…`
    /// columns alongside the dedicated Relatives sheet, etc.).</summary>
    private static readonly IReadOnlySet<string> ApplicantSheetExcludedBranches = new HashSet<string>(StringComparer.Ordinal)
    {
        "family", "followUp", "profile",
    };

    /// <summary>Shallow-clones a payload omitting the named top-level branches.
    /// Used to keep the Applicants sheet clean of branches whose data has its
    /// own dedicated export sheet (relatives, exam results, raw portal profile).</summary>
    private static JsonObject PruneBranches(JsonObject payload, IReadOnlySet<string> excludedTopLevel)
    {
        var pruned = new JsonObject();
        foreach (var (key, node) in payload)
        {
            if (excludedTopLevel.Contains(key)) continue;
            pruned[key] = node?.DeepClone();
        }
        return pruned;
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadDocStoreAsync(DomainSpec spec, string? cycleId, CancellationToken ct)
    {
        // Read through OperationalRecordsService so applicants resolve to the core
        // dbo.applicants projection and other modules to their operational tables.
        // If a module isn't registered in the (evolving) store, export it as empty
        // rather than throwing.
        IReadOnlyList<JsonObject> payloads;
        try { payloads = await records.ListAsync(spec.DocModule!, ct); }
        catch (InvalidOperationException) { return []; }
        var committeeDirectory = spec.Domain == ExchangeDomain.Applicants
            ? await records.LoadCommitteeDirectoryAsync(ct)
            : EmptyCommitteeDirectory;
        var committeeInstances = spec.Domain == ExchangeDomain.Applicants
            ? await LoadCommitteeInstancesAsync(ct)
            : Array.Empty<JsonObject>();
        var result = new List<LoadedRow>(payloads.Count);
        var activeCategoryKeys = spec.Domain == ExchangeDomain.Applicants
            ? await LoadCycleCategoryKeysAsync(cycleId, ct)
            : null;
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            if (spec.Domain == ExchangeDomain.Applicants &&
                !IsApplicantInCycleScope(payload, cycleId, activeCategoryKeys)) continue;
            // Applicants are only exported once the first exam appointment is booked.
            // Draft / incomplete / awaiting-booking rows are intentionally withheld so
            // external consumers receive officially scheduled applicants only.
            if (spec.Domain == ExchangeDomain.Applicants && !IsApplicantBooked(payload)) continue;
            // For the Applicants sheet, prune branches that have their own dedicated
            // sheets so we don't ship `family.father.…` columns next to the dedicated
            // Relatives sheet. Also drop the original `profile.*` shape — the
            // projection already lifts those fields to canonical top-level columns.
            var flattenSource = spec.Domain == ExchangeDomain.Applicants
                ? PruneBranches(WithResolvedCommitteeName(payload, committeeDirectory, committeeInstances), ApplicantSheetExcludedBranches)
                : payload;
            var data = new Dictionary<string, string?>(StringComparer.Ordinal);
            foreach (var (k, v) in JsonFlatten.Flatten(flattenSource))
                if (!NonDataColumns.Contains(k)) data[k] = v; // payload "id" mirrors record id — drop the dup
            var id = payload["id"]?.ToString() ?? "";
            var bk = ResolveDocBusinessKey(spec, payload, id);
            if (string.IsNullOrEmpty(id)) id = bk;
            var created = ParseDto(payload["createdAt"] ?? payload["created_at"]);
            var updated = ParseDto(payload["updatedAt"] ?? payload["updated_at"]) ?? created;
            result.Add(Loaded(id, bk, data, created ?? default, updated ?? default, [],
                payload["lastModifiedBy"]?.ToString(), payload["sourceSystem"]?.ToString()));
        }
        return result;
    }

    private static readonly CommitteeDirectory EmptyCommitteeDirectory = new(
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase));

    private static JsonObject WithResolvedCommitteeName(
        JsonObject applicant,
        CommitteeDirectory committeeDirectory,
        IReadOnlyList<JsonObject> committeeInstances)
    {
        var committeeName = OperationalRecordsService.ResolveCommitteeName(applicant, committeeDirectory, committeeInstances);
        if (string.IsNullOrWhiteSpace(committeeName)) return applicant;
        var enriched = AdminRecordJson.Clone(applicant);
        enriched["committeeName"] = committeeName;
        return enriched;
    }

    /// <summary>
    /// Applicant-export eligibility gate. An applicant is exportable once the
    /// first exam appointment is officially booked — either an `examSlot` is
    /// present with a non-empty slotId / date, or the status has advanced past
    /// `awaiting_exam_booking` into one of the post-booking pipeline states.
    /// </summary>
    private static bool IsApplicantBooked(JsonObject payload)
    {
        if (payload["examSlot"] is JsonObject slot)
        {
            var slotId = slot["slotId"]?.ToString();
            var date = slot["date"]?.ToString();
            if (!string.IsNullOrWhiteSpace(slotId) || !string.IsNullOrWhiteSpace(date)) return true;
        }
        if (!string.IsNullOrWhiteSpace(payload["examSlotId"]?.ToString())) return true;
        if (!string.IsNullOrWhiteSpace(payload["examScheduledAt"]?.ToString())) return true;
        var status = payload["status"]?.ToString();
        return !string.IsNullOrWhiteSpace(status) && BookedOrLaterStatuses.Contains(status);
    }

    private async Task<string?> ResolveCycleIdAsync(string? requestedCycleId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requestedCycleId)) return requestedCycleId.Trim();
        return await db.AdmissionCycles
            .AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<IReadOnlySet<string>?> LoadCycleCategoryKeysAsync(string? cycleId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cycleId)) return null;

        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        async Task AddFromModuleAsync(string module)
        {
            IReadOnlyList<JsonObject> rows;
            try { rows = await records.ListAsync(module, ct); }
            catch (InvalidOperationException) { return; }

            foreach (var row in rows)
            {
                if (!MatchesCycle(FirstString(row, "cycleId", "admissionCycleId", "cycle_id"), cycleId)) continue;
                var category = CategoryKey(row);
                if (!string.IsNullOrWhiteSpace(category)) set.Add(category);
            }
        }

        await AddFromModuleAsync("committeeInstances");
        await AddFromModuleAsync("admissionSetup.examScheduleDays");
        await AddFromApplicationSettingsAsync(cycleId, set, ct);
        await AddFromCommitteeBindingsAsync(cycleId, set, ct);
        return set.Count == 0 ? null : set;
    }

    private async Task AddFromApplicationSettingsAsync(string cycleId, HashSet<string> categoryKeys, CancellationToken ct)
    {
        var module = $"admissionSetup.applicationSettings.{cycleId}";
        JsonObject? draft;
        try { draft = await records.GetAsync(module, module, ct); }
        catch (InvalidOperationException) { return; }
        if (draft is null) return;

        foreach (var row in draft["approved"] as JsonArray ?? [])
        {
            if (row is JsonObject obj) AddCategoryKey(categoryKeys, obj);
        }
        foreach (var row in draft["local"] as JsonArray ?? [])
        {
            if (row is JsonObject obj) AddCategoryKey(categoryKeys, obj);
        }
    }

    private async Task AddFromCommitteeBindingsAsync(string cycleId, HashSet<string> categoryKeys, CancellationToken ct)
    {
        var module = $"admissionSetup.committeeBindings.{cycleId}";
        JsonObject? bindingSet;
        try { bindingSet = await records.GetAsync(module, module, ct); }
        catch (InvalidOperationException) { return; }
        if (bindingSet is null) return;

        foreach (var row in bindingSet["bindings"] as JsonArray ?? [])
        {
            if (row is JsonObject obj) AddCategoryKey(categoryKeys, obj);
        }
    }

    private static void AddCategoryKey(HashSet<string> categoryKeys, JsonObject payload)
    {
        var category = CategoryKey(payload);
        if (!string.IsNullOrWhiteSpace(category)) categoryKeys.Add(category);
    }

    private static bool IsApplicantInCycleScope(
        JsonObject applicant,
        string? cycleId,
        IReadOnlySet<string>? activeCategoryKeys)
    {
        // Lenient on purpose: only drop an applicant when their record positively
        // declares a DIFFERENT cycle. A blank/stale cycle id is treated as in-scope
        // so booked applicants are never silently missing from the export.
        if (BelongsToDifferentCycle(FirstString(applicant, "cycleId", "admissionCycleId", "cycle_id"), cycleId))
        {
            return false;
        }

        // Likewise for category: exclude only when the category is known AND outside
        // the active set. A missing category never removes an otherwise-booked row.
        if (activeCategoryKeys is { Count: > 0 })
        {
            var category = CategoryKey(applicant);
            if (!string.IsNullOrWhiteSpace(category) && !activeCategoryKeys.Contains(category)) return false;
        }

        return true;
    }

    /// <summary>True only when both ids are present and differ — i.e. the row
    /// positively belongs to another cycle. Missing ids are never "different".</summary>
    private static bool BelongsToDifferentCycle(string? rowCycleId, string? cycleId)
        => !string.IsNullOrWhiteSpace(cycleId)
            && !string.IsNullOrWhiteSpace(rowCycleId)
            && !string.Equals(rowCycleId, cycleId, StringComparison.OrdinalIgnoreCase);

    private static bool LoadedRowMatchesCycle(LoadedRow row, string cycleId)
    {
        var rowCycle = FirstValue(row.Data, "cycleId", "admissionCycleId", "cycle_id");
        return MatchesCycle(rowCycle, cycleId);
    }

    private static bool MatchesCycle(string? rowCycleId, string? cycleId)
        => string.IsNullOrWhiteSpace(cycleId) ||
            (!string.IsNullOrWhiteSpace(rowCycleId) &&
             string.Equals(rowCycleId, cycleId, StringComparison.OrdinalIgnoreCase));

    private static string? CategoryKey(JsonObject payload)
        => FirstString(payload, "categoryKey", "categoryId", "applicantCategory", "category");

    private static string? FirstValue(IReadOnlyDictionary<string, string?> values, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }

    private static readonly IReadOnlySet<string> BookedOrLaterStatuses = new HashSet<string>(StringComparer.Ordinal)
    {
        "exam_scheduled",
        "attendance_card_available",
        "awaiting_exam_result",
        "under_medical_review",
        "passed_physical",
        "failed_interview",
        "awaiting_board_decision",
        "approved",
        "acquaintance_doc_opened",
        "under-review",
    };

    private static DateTimeOffset? ParseDto(JsonNode? node)
        => node is not null && DateTimeOffset.TryParse(node.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var d) ? d : null;

    private async Task<IReadOnlyList<LoadedRow>> LoadLookupsAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking().ToListAsync(ct);
        return rows.Select(x =>
        {
            var bk = $"{x.LookupKey}|{x.Code}";
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["lookup_key"] = x.LookupKey, ["code"] = x.Code, ["name"] = x.Name, ["is_active"] = x.IsActive ? "true" : "false",
            };
            // Normalize any extra payload fields (parentId, sort, metadata…) into columns.
            foreach (var (k, v) in JsonFlatten.Flatten(ParseObject(x.PayloadJson)))
                if (k is not ("code" or "name") && !NonDataColumns.Contains(k)) data[k] = v;
            return Loaded(bk, bk, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadAdmissionConditionsAsync(string? cycleId, CancellationToken ct)
    {
        var rows = new List<LoadedRow>();
        rows.AddRange(await LoadAdmissionRulesAsync(cycleId, ct));
        rows.AddRange(await LoadCycleApplicationSettingsAsync(cycleId, ct));
        return rows;
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadAdmissionRulesAsync(string? cycleId, CancellationToken ct)
    {
        var rows = await db.AdmissionRules
            .AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(cycleId) || x.CycleId == cycleId)
            .ToListAsync(ct);
        return rows.Select(x =>
        {
            var bk = $"{x.CycleId}|{x.Version}";
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["record_type"] = "admission_rule",
                ["cycle_id"] = x.CycleId, ["version"] = x.Version.ToString(CultureInfo.InvariantCulture),
            };
            foreach (var (k, v) in JsonFlatten.Flatten(ParseObject(x.PayloadJson)))
                if (k is not ("cycleId" or "version") && !NonDataColumns.Contains(k)) data[k] = v;
            return Loaded(x.Id, bk, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadCycleApplicationSettingsAsync(string? cycleId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cycleId)) return [];

        var module = $"admissionSetup.applicationSettings.{cycleId}";
        JsonObject? payload;
        try { payload = await records.GetAsync(module, module, ct); }
        catch (InvalidOperationException) { return []; }
        if (payload is null) return [];

        var data = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["record_type"] = "application_settings",
            ["cycleId"] = cycleId,
        };
        foreach (var (key, value) in JsonFlatten.Flatten(payload))
            if (!NonDataColumns.Contains(key)) data[key] = value;

        var updated = ParseDto(payload["updatedAt"] ?? payload["updated_at"]) ?? default;
        var created = ParseDto(payload["createdAt"] ?? payload["created_at"]) ?? updated;
        return [Loaded(module, module, data, created, updated, [], null, "admission-setup")];
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamsAsync(string? cycleId, CancellationToken ct)
    {
        var rows = new List<LoadedRow>();
        rows.AddRange(await LoadExamEntitiesAsync(cycleId, ct));
        rows.AddRange(await LoadExamPlansAsync(cycleId, ct));
        return rows;
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamEntitiesAsync(string? cycleId, CancellationToken ct)
    {
        var rows = await db.Exams
            .AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(cycleId) || x.CycleId == cycleId)
            .ToListAsync(ct);
        return rows.Select(x => Loaded(x.Id, x.Id, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["record_type"] = "exam",
            ["name_ar"] = x.NameAr, ["cycle_id"] = x.CycleId, ["cycle_name"] = x.CycleName, ["scheduled_for"] = x.ScheduledFor,
            ["access_start_at"] = x.AccessStartAt, ["access_end_at"] = x.AccessEndAt,
            ["duration_minutes"] = x.DurationMinutes?.ToString(CultureInfo.InvariantCulture),
            ["question_count"] = x.QuestionCount?.ToString(CultureInfo.InvariantCulture),
            ["random_selection"] = x.RandomSelection?.ToString().ToLowerInvariant(),
            ["random_question_order"] = x.RandomQuestionOrder?.ToString().ToLowerInvariant(),
            ["display_mode"] = x.DisplayMode, ["status"] = x.Status,
        }, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem)).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamPlansAsync(string? cycleId, CancellationToken ct)
    {
        IReadOnlyList<JsonObject> plans;
        try { plans = await records.ListAsync("examPlans", ct); }
        catch (InvalidOperationException) { return []; }

        var result = new List<LoadedRow>();
        foreach (var plan in plans)
        {
            if (AdminRecordJson.IsSoftDeleted(plan)) continue;
            if (!MatchesCycle(FirstString(plan, "cycleId", "admissionCycleId", "cycle_id"), cycleId)) continue;
            result.AddRange(ToExamPlanRows(plan));
        }
        return result;
    }

    private static IReadOnlyList<LoadedRow> ToExamPlanRows(JsonObject plan)
    {
        var cycleId = FirstString(plan, "cycleId", "admissionCycleId", "cycle_id");
        var categoryId = FirstString(plan, "categoryId", "categoryKey", "applicantCategory");
        var updated = ParseDto(plan["updatedAt"] ?? plan["updated_at"]) ?? default;
        var created = ParseDto(plan["createdAt"] ?? plan["created_at"]) ?? updated;
        var source = plan["sourceSystem"]?.ToString();
        var rows = new List<LoadedRow>();
        var order = 0;

        foreach (var node in plan["exams"] as JsonArray ?? [])
        {
            if (node is not JsonObject exam) continue;
            order++;
            var examId = FirstString(exam, "examId", "id", "key", "code") ?? $"exam-{order}";
            var businessKey = Compose(Compose(cycleId, categoryId), examId);
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["record_type"] = "exam_plan",
                ["cycleId"] = cycleId,
                ["categoryId"] = categoryId,
                ["examId"] = examId,
            };
            foreach (var (key, value) in JsonFlatten.Flatten(exam))
                if (!NonDataColumns.Contains(key)) data[key] = value;
            rows.Add(Loaded(businessKey, businessKey, data, created, updated, [], null, source ?? "exam-plans"));
        }
        return rows;
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamSchedulesAsync(string? cycleId, CancellationToken ct)
    {
        var rows = new List<JsonObject>();
        rows.AddRange(await ListOperationalScheduleRowsAsync("committeeInstances", cycleId, ct));
        rows.AddRange(await ListOperationalScheduleRowsAsync("admissionSetup.examScheduleDays", cycleId, ct));
        return rows.Select(ToExamScheduleRow).ToList();
    }

    private async Task<IReadOnlyList<JsonObject>> ListOperationalScheduleRowsAsync(
        string module,
        string? cycleId,
        CancellationToken ct)
    {
        IReadOnlyList<JsonObject> rows;
        try { rows = await records.ListAsync(module, ct); }
        catch (InvalidOperationException) { return []; }
        return rows
            .Where(row => !AdminRecordJson.IsSoftDeleted(row))
            .Where(row => string.IsNullOrWhiteSpace(cycleId) ||
                MatchesCycle(FirstString(row, "cycleId", "admissionCycleId", "cycle_id"), cycleId))
            .ToList();
    }

    private static LoadedRow ToExamScheduleRow(JsonObject payload)
    {
        var data = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var (key, value) in JsonFlatten.Flatten(payload))
            if (!NonDataColumns.Contains(key)) data[key] = value;
        data["time"] = FirstString(payload, "time", "slotTime", "examTime") ?? DefaultExamScheduleTime;
        var id = FirstString(payload, "id") ?? FirstString(payload, "dayId") ?? "";
        var businessKey = string.IsNullOrWhiteSpace(id)
            ? Compose(FirstString(payload, "cycleId"), FirstString(payload, "date", "day", "examDate"))
            : id;
        return Loaded(
            string.IsNullOrWhiteSpace(id) ? businessKey : id,
            businessKey,
            data,
            ParseDto(payload["createdAt"] ?? payload["created_at"]) ?? default,
            ParseDto(payload["updatedAt"] ?? payload["updated_at"]) ?? default,
            [],
            payload["lastModifiedBy"]?.ToString(),
            payload["sourceSystem"]?.ToString());
    }

    /// <summary>Explodes each booked applicant's `family` payload into per-member
    /// rows so the Relatives sheet links back to the applicant via
    /// `applicantNationalId`. Covers father, mother, paternal/maternal
    /// grandparents, fatherWives[], motherHusbands[], siblings[],
    /// extended relatives[] (uncles/aunts), and guardian.</summary>
    private async Task<IReadOnlyList<LoadedRow>> LoadApplicantRelativesAsync(string? cycleId, CancellationToken ct)
    {
        IReadOnlyList<JsonObject> applicants;
        try { applicants = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return []; }

        var activeCategoryKeys = await LoadCycleCategoryKeysAsync(cycleId, ct);
        var result = new List<LoadedRow>();
        foreach (var applicant in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(applicant)) continue;
            if (!IsApplicantInCycleScope(applicant, cycleId, activeCategoryKeys)) continue;
            if (!IsApplicantBooked(applicant)) continue;
            var nid = applicant["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            var family = applicant["family"] as JsonObject;
            if (family is null) continue;

            var updated = ParseDto(applicant["updatedAt"] ?? applicant["updated_at"]) ?? default;
            var created = ParseDto(applicant["createdAt"] ?? applicant["created_at"]) ?? updated;
            var applicantCycleId = FirstString(applicant, "cycleId", "admissionCycleId", "cycle_id");

            void Emit(string seq, string kinshipKey, JsonObject? member)
            {
                if (member is null) return;
                var data = ProjectFamilyMember(member, kinshipKey);
                if (data.Count == 0) return;
                data["applicantNationalId"] = nid;
                data["cycleId"] = applicantCycleId;
                var bk = $"{nid}|{seq}";
                result.Add(Loaded(bk, bk, data, created, updated, [], null, "applicant-portal"));
            }

            Emit("father", "father", family["father"] as JsonObject);
            Emit("mother", "mother", family["mother"] as JsonObject);
            Emit("paternalGrandfather", "paternal_grandfather", family["paternalGrandfather"] as JsonObject);
            Emit("paternalGrandmother", "paternal_grandmother", family["paternalGrandmother"] as JsonObject);
            Emit("maternalGrandfather", "maternal_grandfather", family["maternalGrandfather"] as JsonObject);
            Emit("maternalGrandmother", "maternal_grandmother", family["maternalGrandmother"] as JsonObject);
            Emit("guardian", "guardian", family["guardian"] as JsonObject);

            var idx = 0;
            foreach (var node in family["fatherWives"] as JsonArray ?? [])
                Emit($"fatherWife_{++idx}", "father_wife", node as JsonObject);
            idx = 0;
            foreach (var node in family["motherHusbands"] as JsonArray ?? [])
                Emit($"motherHusband_{++idx}", "mother_husband", node as JsonObject);
            idx = 0;
            foreach (var node in family["siblings"] as JsonArray ?? [])
                Emit($"sibling_{++idx}", InferKinshipFromRelationship(node, "sibling"), node as JsonObject);
            idx = 0;
            foreach (var node in family["relatives"] as JsonArray ?? [])
                Emit($"relative_{++idx}", InferKinshipFromRelationship(node, "relative"), node as JsonObject);
        }
        return result;
    }

    private static Dictionary<string, string?> ProjectFamilyMember(JsonObject member, string kinshipKey)
    {
        var data = new Dictionary<string, string?>(StringComparer.Ordinal) { ["kinship"] = kinshipKey };
        var fullName = member["fullName"]?.ToString();
        if (!string.IsNullOrWhiteSpace(fullName)) data["name"] = fullName;
        var memberNid = member["nationalId"]?.ToString();
        if (!string.IsNullOrWhiteSpace(memberNid)) data["nationalId"] = memberNid;
        var occupation = member["occupation"]?.ToString();
        if (!string.IsNullOrWhiteSpace(occupation)) data["occupation"] = occupation;
        var governorate = member["governorate"]?.ToString();
        if (!string.IsNullOrWhiteSpace(governorate)) data["governorate"] = governorate;
        var education = member["education"]?.ToString();
        if (!string.IsNullOrWhiteSpace(education)) data["education"] = education;
        var alive = member["alive"];
        if (alive is not null) data["alive"] = alive.ToString().ToLowerInvariant();
        var relationshipId = member["relationshipId"]?.ToString();
        if (!string.IsNullOrWhiteSpace(relationshipId)) data["relationshipLabel"] = relationshipId;
        return data;
    }

    private static string InferKinshipFromRelationship(JsonNode? node, string fallback)
    {
        if (node is not JsonObject obj) return fallback;
        var rel = obj["relationshipId"]?.ToString();
        return rel switch
        {
            "الأخ" => "brother",
            "الأخت" => "sister",
            "العم" => "paternal_uncle",
            "العمة" => "paternal_aunt",
            "الخال" => "maternal_uncle",
            "الخالة" => "maternal_aunt",
            _ => fallback,
        };
    }

    /// <summary>Explodes each booked applicant's `followUp` outcomes into one
    /// row per (applicantNationalId, examCode). Mirrors the same shape Stage-10
    /// reads — `followUp[TST-NN] = passed|failed|in-progress|awaiting-approval|pending`.
    /// </summary>
    private async Task<IReadOnlyList<LoadedRow>> LoadApplicantExamResultsAsync(string? cycleId, CancellationToken ct)
    {
        IReadOnlyList<JsonObject> applicants;
        try { applicants = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return []; }

        var activeCategoryKeys = await LoadCycleCategoryKeysAsync(cycleId, ct);
        var result = new List<LoadedRow>();
        foreach (var applicant in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(applicant)) continue;
            if (!IsApplicantInCycleScope(applicant, cycleId, activeCategoryKeys)) continue;
            if (!IsApplicantBooked(applicant)) continue;
            var nid = applicant["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            var followUp = applicant["followUp"] as JsonObject;
            if (followUp is null || followUp.Count == 0) continue;

            var updated = ParseDto(applicant["updatedAt"] ?? applicant["updated_at"]) ?? default;
            var created = ParseDto(applicant["createdAt"] ?? applicant["created_at"]) ?? updated;
            var applicantCycleId = FirstString(applicant, "cycleId", "admissionCycleId", "cycle_id");
            foreach (var (examCode, node) in followUp)
            {
                var outcome = node?.ToString();
                if (string.IsNullOrWhiteSpace(examCode) || string.IsNullOrWhiteSpace(outcome)) continue;
                var bk = $"{nid}|{examCode}";
                var data = new Dictionary<string, string?>(StringComparer.Ordinal)
                {
                    ["applicantNationalId"] = nid,
                    ["cycleId"] = applicantCycleId,
                    ["examCode"] = examCode,
                    ["result"] = outcome,
                };
                result.Add(Loaded(bk, bk, data, created, updated, [], null, "applicant-portal"));
            }
        }
        return result;
    }

    /// <summary>Reads acquaintance-doc rows from the dedicated table introduced
    /// by the 2026-06-02 migration. Joins applicant identity to surface the
    /// canonical `applicantNationalId` FK column.</summary>
    private async Task<IReadOnlyList<LoadedRow>> LoadAcquaintanceDocsAsync(string? cycleId, CancellationToken ct)
    {
        if (!db.Database.IsRelational()) return [];
        var docs = await db.ApplicantAcquaintanceDocs.AsNoTracking().ToListAsync(ct);
        if (docs.Count == 0) return [];

        // Resolve applicantId(GUID) → nationalId via the booked-applicants map.
        var nidById = await LoadApplicantNidByRecordIdAsync(cycleId, ct);

        var result = new List<LoadedRow>(docs.Count);
        foreach (var doc in docs)
        {
            if (BelongsToDifferentCycle(doc.CycleId, cycleId)) continue;
            if (!nidById.TryGetValue(doc.ApplicantId, out var nid)) continue;
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["applicantNationalId"] = nid,
                ["cycleId"] = doc.CycleId,
                ["status"] = doc.Status,
            };
            if (doc.OpenedAt is { } opened) data["openedAt"] = opened.ToString("O", CultureInfo.InvariantCulture);
            if (doc.ClosedAt is { } closed) data["closedAt"] = closed.ToString("O", CultureInfo.InvariantCulture);
            if (doc.LastAutosavedAt is { } saved) data["lastAutosavedAt"] = saved.ToString("O", CultureInfo.InvariantCulture);
            var bk = $"{nid}|{doc.CycleId}";
            result.Add(Loaded(doc.Id, bk, data, doc.CreatedAt, doc.UpdatedAt, [], null, "acquaintance-doc"));
        }
        return result;
    }

    /// <summary>Booked applicants' nationalId keyed by every record id shape the
    /// acquaintance-doc table may reference (applicantTableId GUID or record id).</summary>
    private async Task<IReadOnlyDictionary<string, string>> LoadApplicantNidByRecordIdAsync(string? cycleId, CancellationToken ct)
    {
        var booked = await LoadBookedApplicantsByNidAsync(cycleId, ct);
        var nidById = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (nid, payload) in booked)
        {
            var tableId = payload["applicantTableId"]?.ToString();
            if (!string.IsNullOrWhiteSpace(tableId)) nidById[tableId] = nid;
            var id = payload["id"]?.ToString();
            if (!string.IsNullOrWhiteSpace(id)) nidById[id] = nid;
        }
        return nidById;
    }

    // ──────────────────────────────────────────────────────────────────────
    // WRITE (per storage kind) — reconstructs payloads type-safely
    // ──────────────────────────────────────────────────────────────────────
    private async Task UpsertAsync(DomainSpec spec, IReadOnlyDictionary<string, string?> row, LoadedRow? existing, CancellationToken ct)
    {
        switch (spec.Storage)
        {
            case ExchangeStorage.DocStore: await UpsertDocStoreAsync(spec, row, ct); break;
            case ExchangeStorage.Lookups: await UpsertLookupAsync(row, ct); break;
            case ExchangeStorage.AdmissionRules: await UpsertAdmissionRuleAsync(row, ct); break;
            case ExchangeStorage.Exams: await UpsertExamAsync(row, ct); break;
            case ExchangeStorage.ExamSlots: await UpsertExamSlotAsync(row, ct); break;
            case ExchangeStorage.ReadOnlyExport:
                throw Invalid("هذه الورقة للتصدير فقط ولا يمكن استيرادها.");
        }
    }

    private static IReadOnlySet<string> SkipKeys(params string[] extra)
        => new HashSet<string>(NonDataColumns.Concat(extra), StringComparer.Ordinal);

    private async Task UpsertDocStoreAsync(DomainSpec spec, IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? Get(row, "business_key") ?? throw Invalid("id مفقود");
        // Merge edited normalized columns into the existing payload (type-safe),
        // then write through OperationalRecordsService so normalized-table domains
        // (applicants) take the correct write path.
        var original = await records.GetAsync(spec.DocModule!, id, ct);
        var payload = JsonFlatten.Unflatten(row, original, SkipKeys());
        payload["id"] = id;
        payload["sourceSystem"] = ImportSource;
        await records.UpsertAsync(spec.DocModule!, id, payload, ct);
    }

    private async Task UpsertLookupAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var key = Get(row, "lookup_key") ?? throw Invalid("lookup_key مفقود");
        var code = Get(row, "code") ?? throw Invalid("code مفقود");
        var name = Get(row, "name") ?? code;
        var existing = await db.LookupRows.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct);
        var original = existing is null ? null : ParseObject(existing.PayloadJson);
        var payload = JsonFlatten.Unflatten(row, original, SkipKeys("lookup_key", "code", "name", "is_active"));
        payload["code"] = code; payload["name"] = name;
        var jsonStr = payload.ToJsonString(Json);
        if (existing is null)
            db.LookupRows.Add(new LookupRowEntity { LookupKey = key, Code = code, Name = name, IsActive = ParseBool(Get(row, "is_active")) ?? true, PayloadJson = jsonStr, SourceSystem = ImportSource });
        else { existing.Name = name; existing.IsActive = ParseBool(Get(row, "is_active")) ?? existing.IsActive; existing.PayloadJson = jsonStr; existing.SourceSystem = ImportSource; }
    }

    private async Task UpsertAdmissionRuleAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.AdmissionRules.FirstOrDefaultAsync(x => x.Id == id, ct);
        var original = existing is null ? null : ParseObject(existing.PayloadJson);
        var payload = JsonFlatten.Unflatten(row, original, SkipKeys("cycle_id", "version"));
        var jsonStr = payload.ToJsonString(Json);
        if (existing is null)
            db.AdmissionRules.Add(new AdmissionRuleEntity { Id = id, CycleId = Get(row, "cycle_id") ?? "", Version = ParseInt(Get(row, "version")) ?? 1, PayloadJson = jsonStr, SourceSystem = ImportSource });
        else { existing.CycleId = Get(row, "cycle_id") ?? existing.CycleId; existing.Version = ParseInt(Get(row, "version")) ?? existing.Version; existing.PayloadJson = jsonStr; existing.SourceSystem = ImportSource; }
    }

    private async Task UpsertExamAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.Exams.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing is null)
            db.Exams.Add(new ExamEntity
            {
                Id = id, NameAr = Get(row, "name_ar") ?? id, CycleId = Get(row, "cycle_id") ?? "", CycleName = Get(row, "cycle_name"),
                ScheduledFor = Get(row, "scheduled_for"), AccessStartAt = Get(row, "access_start_at"), AccessEndAt = Get(row, "access_end_at"),
                DurationMinutes = ParseInt(Get(row, "duration_minutes")), QuestionCount = ParseInt(Get(row, "question_count")),
                RandomSelection = ParseBool(Get(row, "random_selection")), RandomQuestionOrder = ParseBool(Get(row, "random_question_order")),
                DisplayMode = Get(row, "display_mode"), Status = Get(row, "status") ?? "draft", SourceSystem = ImportSource,
            });
        else
        {
            existing.NameAr = Get(row, "name_ar") ?? existing.NameAr; existing.CycleId = Get(row, "cycle_id") ?? existing.CycleId;
            existing.CycleName = Get(row, "cycle_name") ?? existing.CycleName; existing.ScheduledFor = Get(row, "scheduled_for") ?? existing.ScheduledFor;
            existing.AccessStartAt = Get(row, "access_start_at") ?? existing.AccessStartAt; existing.AccessEndAt = Get(row, "access_end_at") ?? existing.AccessEndAt;
            existing.DurationMinutes = ParseInt(Get(row, "duration_minutes")) ?? existing.DurationMinutes; existing.QuestionCount = ParseInt(Get(row, "question_count")) ?? existing.QuestionCount;
            existing.RandomSelection = ParseBool(Get(row, "random_selection")) ?? existing.RandomSelection; existing.RandomQuestionOrder = ParseBool(Get(row, "random_question_order")) ?? existing.RandomQuestionOrder;
            existing.DisplayMode = Get(row, "display_mode") ?? existing.DisplayMode; existing.Status = Get(row, "status") ?? existing.Status; existing.SourceSystem = ImportSource;
        }
    }

    private async Task UpsertExamSlotAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.ExamSlots.FirstOrDefaultAsync(x => x.Id == id, ct);
        var date = ParseDateOnly(Get(row, "date"));
        if (existing is null)
            db.ExamSlots.Add(new ExamSlotEntity { Id = id, Date = date ?? default, Time = Get(row, "time") ?? "08:00", Location = Get(row, "location") ?? "", Capacity = ParseInt(Get(row, "capacity")) ?? 0, Reserved = ParseInt(Get(row, "reserved")) ?? 0, SourceSystem = ImportSource });
        else { if (date is { } d) existing.Date = d; existing.Time = Get(row, "time") ?? existing.Time; existing.Location = Get(row, "location") ?? existing.Location; existing.Capacity = ParseInt(Get(row, "capacity")) ?? existing.Capacity; existing.Reserved = ParseInt(Get(row, "reserved")) ?? existing.Reserved; existing.SourceSystem = ImportSource; }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Business key + validation
    // ──────────────────────────────────────────────────────────────────────
    private static (string Key, List<string> Errors) ResolveBusinessKey(DomainSpec spec, IReadOnlyDictionary<string, string?> row)
    {
        var errors = new List<string>();
        var explicitKey = Get(row, "business_key");
        var key = spec.Storage switch
        {
            ExchangeStorage.Lookups => Compose(Get(row, "lookup_key"), Get(row, "code")),
            ExchangeStorage.AdmissionRules => Compose(Get(row, "cycle_id"), Get(row, "version")),
            ExchangeStorage.DocStore when spec.BusinessKeyFields.Count > 0
                => string.Join("|", spec.BusinessKeyFields.Select(f => Get(row, f) ?? "")),
            _ => Get(row, "id") ?? "",
        };
        if (string.IsNullOrWhiteSpace(key) || key == "|") key = explicitKey ?? Get(row, "id") ?? "";
        if (string.IsNullOrWhiteSpace(key)) errors.Add("لا يمكن اشتقاق مفتاح الصف (id/business_key مفقود)");

        if (spec.Domain == ExchangeDomain.Applicants)
        {
            var nid = Get(row, "nationalId");
            if (!string.IsNullOrEmpty(nid) && (nid.Length != 14 || !nid.All(char.IsDigit)))
                errors.Add("الرقم القومي غير صالح (14 رقمًا)");
        }
        return (key, errors);
    }

    private static string ResolveDocBusinessKey(DomainSpec spec, JsonObject payload, string id)
    {
        if (spec.BusinessKeyFields.Count == 0) return id;
        var parts = spec.BusinessKeyFields.Select(f => payload[f]?.ToString() ?? "").ToList();
        return parts.All(string.IsNullOrEmpty) ? id : string.Join("|", parts);
    }

    // ── helpers ─────────────────────────────────────────────────────────────
    private static LoadedRow Loaded(string id, string bk, Dictionary<string, string?> data,
        DateTimeOffset created, DateTimeOffset updated, byte[] rowVersion, string? lastBy, string? source)
        => new(id, bk, data, created, updated, rowVersion ?? [], lastBy,
               string.IsNullOrEmpty(source) ? ChangeTrackingColumns.DefaultSourceSystem : source);

    private static string Compose(string? a, string? b) => string.IsNullOrEmpty(a) && string.IsNullOrEmpty(b) ? "" : $"{a}|{b}";
    private static string? Get(IReadOnlyDictionary<string, string?> row, string key) => row.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v) ? v : null;

    private static JsonObject ParseObject(string json)
    {
        try { return JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json) as JsonObject ?? new JsonObject(); }
        catch (JsonException) { return new JsonObject(); }
    }

    private static int? ParseInt(string? s) => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static bool? ParseBool(string? s) => bool.TryParse(s, out var v) ? v : (s == "1" ? true : s == "0" ? false : null);
    private static DateOnly? ParseDateOnly(string? s) => DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var v) ? v : null;
    private static InvalidOperationException Invalid(string message) => new(message);

    private static bool TryDecodeRowVersion(string? raw, out byte[] value)
    {
        value = [];
        if (string.IsNullOrWhiteSpace(raw)) return false;
        try { value = Convert.FromBase64String(raw); return true; } catch (FormatException) { return false; }
    }

    private static int CompareRowVersion(byte[] a, byte[] b)
    {
        var max = Math.Max(a.Length, b.Length);
        for (var i = 0; i < max; i++)
        {
            var ai = i < max - a.Length ? 0 : a[i - (max - a.Length)];
            var bi = i < max - b.Length ? 0 : b[i - (max - b.Length)];
            if (ai != bi) return ai.CompareTo(bi);
        }
        return 0;
    }

    private async Task EmitAuditAsync(string action, string message, int total, int inserted, int updated, int skipped, int failed, CancellationToken ct)
    {
        var details = new JsonObject { ["message"] = message, ["total"] = total, ["inserted"] = inserted, ["updated"] = updated, ["skipped"] = skipped, ["failed"] = failed };
        await auditSink.EmitAsync(new AuditEntry($"AUD-DATAX-{Guid.NewGuid():N}", Module, action, AuditEntityType, Module,
            actor.CurrentActorId, actor.CurrentActorId, details.ToJsonString(Json), DateTimeOffset.UtcNow), ct);
    }

    private sealed record LoadedRow(string Id, string BusinessKey, Dictionary<string, string?> Data,
        DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, byte[] RowVersion, string? LastModifiedBy, string SourceSystem);

    // ══════════════════════════════════════════════════════════════════════
    // CURATED SNAPSHOT EXPORT — fixed-column, cycle-scoped, per the data-exchange
    // workbook contract. Independent of the import/round-trip machinery above.
    // ══════════════════════════════════════════════════════════════════════

    private sealed record CuratedRow(
        IReadOnlyDictionary<string, string?> Cells,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        string? PersonKey);

    /// <summary>Per-export shared state. Applicant payloads and the exam
    /// resolver are memoized lazies — six sheets read applicants and two
    /// resolve exams, and re-running those loads per sheet dominated export
    /// latency (each applicants load is the normalized UNION query). Loaders
    /// resolve committee names themselves, so the applicants load skips
    /// enrichment (identical output, three queries cheaper).</summary>
    private sealed record CuratedContext(
        CommitteeDirectory CommitteeDirectory,
        IReadOnlyList<JsonObject> CommitteeInstances,
        IReadOnlySet<string>? ActiveCategoryKeys,
        string? ActiveCycleId,
        Lazy<Task<IReadOnlyList<JsonObject>>> ApplicantsLazy,
        Lazy<Task<CuratedExamResolver>> ExamResolverLazy)
    {
        public Task<IReadOnlyList<JsonObject>> ApplicantsAsync() => ApplicantsLazy.Value;
        public Task<CuratedExamResolver> ExamResolverAsync() => ExamResolverLazy.Value;
    }

    /// <summary>Locked curated-snapshot sheet registry. The order here is the
    /// workbook sheet order (after the frontend-built ExportInfo sheet). Columns
    /// are fixed + human-readable; mirrored by the frontend `EXPORT_DOMAINS`.
    ///
    /// Unique-identifier rule (2026-06-10): every sheet carries a stable per-row
    /// unique key (`*_id` / business key) so re-import, dedup, and cross-sheet
    /// mapping always have an anchor. Internal/system sheets (Committees,
    /// ApplicantCategories, Faculties, Notifications, WorkflowRecords,
    /// AuditEntries) were dropped from the snapshot the same day — they stay in
    /// <see cref="DataExchangeRegistry"/> only so previously exported workbooks
    /// still parse on import.</summary>
    private static readonly IReadOnlyList<CuratedSheetSpec> CuratedSheets =
    [
        new(ExchangeDomain.Applicants, "Applicants", "بيانات المتقدمين",
            ["applicant_id", "national_id", "full_name", "gender", "phone_number", "email", "date_of_birth", "birth_governorate",
             "qualification_type", "university", "faculty", "specialization", "graduation_year", "grade", "percentage",
             "school_name", "school_category", "secondary_total_score", "secondary_percentage", "secondary_graduation_year",
             "category", "cycle_id", "status"],
            CycleScoped: true, PersonScoped: true),
        new(ExchangeDomain.Relatives, "Relatives", "أقارب المتقدمين",
            ["relative_id", "applicant_id", "relation_type", "relation_label", "full_name", "national_id", "gender", "qualification", "occupation", "phone", "governorate", "address"],
            CycleScoped: true, PersonScoped: true),
        new(ExchangeDomain.Exams, "Exams", "اختبارات دورة القبول",
            ["exam_id", "exam_name", "cycle_id", "scheduled_for", "duration_minutes", "question_count", "status"],
            CycleScoped: true, PersonScoped: false),
        new(ExchangeDomain.ExamSchedules, "ExamSchedules", "جدول مواعيد الاختبارات",
            ["slot_id", "exam_id", "exam_name", "category", "date", "committee_name", "capacity", "reserved"],
            CycleScoped: true, PersonScoped: false),
        new(ExchangeDomain.ExamReservations, "ExamReservations", "حجوزات المتقدمين للاختبارات",
            ["applicant_national_id", "applicant_name", "slot_id", "exam_id", "exam_name", "appointment_date",
             "appointment_time", "committee_name", "reservation_status"],
            CycleScoped: true, PersonScoped: true),
        new(ExchangeDomain.ExamResults, "ExamResults", "نتائج اختبارات المتقدمين",
            ["result_id", "applicant_id", "exam_id", "exam_name", "result", "score", "committee", "exam_date"],
            CycleScoped: true, PersonScoped: true),
        new(ExchangeDomain.AcquaintanceDocs, "AcquaintanceDocs", "وثائق التعارف",
            ["record_id", "applicant_national_id", "cycle_id", "doc_status", "version", "opened_at", "closed_at", "last_autosaved_at",
             "section_key", "section_data", "revision_count", "last_revision_kind", "last_revision_at"],
            CycleScoped: true, PersonScoped: true),
        new(ExchangeDomain.AdmissionConditions, "AdmissionConditions", "شروط القبول",
            ["condition_id", "category", "category_name", "faculty", "specialization", "academic_degree", "graduation_year", "gender",
             "marital_status", "min_age", "max_age", "age_reference_date", "min_percentage", "max_percentage",
             "min_grade", "max_grade", "division", "school_category", "exam_round", "committee",
             "excellence_criterion", "application_start_date", "application_end_date", "condition_status", "is_active"],
            CycleScoped: true, PersonScoped: false),
        new(ExchangeDomain.LookupRows, "LookupRows", "القوائم المرجعية",
            ["lookup_row_id", "lookup_key", "code", "name", "is_active"],
            CycleScoped: false, PersonScoped: false),
        new(ExchangeDomain.GeneralSettings, "GeneralSettings", "الإعدادات العامة",
            ["settings_id", "exam_days_per_applicant", "exam_slot_selection_window_days", "acquaintance_documents_open_timing", "acquaintance_documents_close_timing"],
            CycleScoped: false, PersonScoped: false),
        new(ExchangeDomain.Payments, "Payments", "مدفوعات المتقدمين",
            ["payment_id", "applicant_id", "national_id", "applicant_name", "amount", "payment_status",
             "payment_method", "payment_date", "fawry_reference", "cycle_id"],
            CycleScoped: true, PersonScoped: true),
    ];

    private async Task<CuratedContext> BuildCuratedContextAsync(string? cycleId, CancellationToken ct)
        => new(
            await records.LoadCommitteeDirectoryAsync(ct),
            await LoadCommitteeInstancesAsync(ct),
            await LoadCycleCategoryKeysAsync(cycleId, ct),
            await db.AdmissionCycles.AsNoTracking().Where(c => c.IsActive).Select(c => c.Id).FirstOrDefaultAsync(ct),
            new(() => LoadApplicantsUnenrichedAsync(ct)),
            new(() => BuildCuratedExamResolverAsync(cycleId, ct)));

    private async Task<IReadOnlyList<JsonObject>> LoadApplicantsUnenrichedAsync(CancellationToken ct)
    {
        try { return await records.ListAsync("applicants", enrichApplicantCommitteeNames: false, ct); }
        catch (InvalidOperationException) { return []; }
    }

    /// <summary>Ctx-backed mirror of <see cref="LoadApplicantNidByRecordIdAsync"/>
    /// for curated loaders: same booked + cycle scoping, but reads the export's
    /// memoized applicant list instead of re-querying (the cycleId reaching
    /// curated loaders is already resolved).</summary>
    private static async Task<IReadOnlyDictionary<string, string>> BuildApplicantNidByRecordIdAsync(
        string? cycleId, CuratedContext ctx)
    {
        var nidById = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var payload in await ctx.ApplicantsAsync())
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            if (!IsApplicantInCycleScope(payload, cycleId, ctx.ActiveCategoryKeys)) continue;
            if (!IsApplicantBooked(payload)) continue;
            var nid = payload["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;

            var tableId = payload["applicantTableId"]?.ToString();
            if (!string.IsNullOrWhiteSpace(tableId)) nidById[tableId] = nid;
            var id = payload["id"]?.ToString();
            if (!string.IsNullOrWhiteSpace(id)) nidById[id] = nid;
        }
        return nidById;
    }

    private Task<IReadOnlyList<CuratedRow>> LoadCuratedAsync(
        CuratedSheetSpec spec, string? cycleId, CuratedContext ctx, CancellationToken ct) => spec.Domain switch
    {
        ExchangeDomain.Applicants          => LoadCuratedApplicantsAsync(cycleId, ctx, ct),
        ExchangeDomain.Relatives           => LoadCuratedRelativesAsync(cycleId, ctx, ct),
        ExchangeDomain.Exams               => LoadCuratedExamsAsync(cycleId, ct),
        ExchangeDomain.ExamSchedules       => LoadCuratedExamSchedulesAsync(cycleId, ctx, ct),
        ExchangeDomain.ExamReservations    => LoadCuratedExamReservationsAsync(cycleId, ctx, ct),
        ExchangeDomain.ExamResults         => LoadCuratedExamResultsAsync(cycleId, ctx, ct),
        ExchangeDomain.AcquaintanceDocs    => LoadCuratedAcquaintanceDocsAsync(cycleId, ctx, ct),
        ExchangeDomain.AdmissionConditions => LoadCuratedAdmissionConditionsAsync(cycleId, ctx, ct),
        ExchangeDomain.LookupRows          => LoadCuratedLookupRowsAsync(ct),
        ExchangeDomain.GeneralSettings     => LoadCuratedGeneralSettingsAsync(ct),
        ExchangeDomain.Payments            => LoadCuratedPaymentsAsync(cycleId, ctx, ct),
        _ => Task.FromResult<IReadOnlyList<CuratedRow>>([]),
    };

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedApplicantsAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var payloads = await ctx.ApplicantsAsync();
        var rows = new List<CuratedRow>(payloads.Count);
        foreach (var p in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(p)) continue;
            if (!IsApplicantInCycleScope(p, cycleId, ctx.ActiveCategoryKeys)) continue;
            if (!IsApplicantBooked(p)) continue;
            var nid = p["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            var (created, updated) = Timestamps(p);
            rows.Add(new CuratedRow(Cells(
                ("applicant_id", FirstString(p, "id") ?? nid),
                ("national_id", nid),
                ("full_name", ApplicantField(p, "fullName", "name")),
                ("gender", ApplicantField(p, "gender")),
                ("phone_number", ApplicantField(p, "phoneNumber", "mobile", "phone")),
                ("email", ApplicantField(p, "email")),
                ("date_of_birth", ApplicantField(p, "birthDate", "dateOfBirth", "dob")),
                ("birth_governorate", ApplicantField(p, "birthGovernorate")),
                ("qualification_type", ApplicantField(p, "certType")
                    ?? EducationField(p, "higherSpecialization", "certificateName")
                    ?? FirstNested(p, "profile", "qualificationLevel")),
                ("university", EducationField(p, "university") ?? FirstNested(p, "profile", "bachelorUniversity")),
                ("faculty", EducationField(p, "faculty") ?? FirstNested(p, "profile", "bachelorFaculty")),
                ("specialization", EducationField(p, "specialization")
                    ?? FirstNested(p, "profile", "bachelorSpecialization", "bachelorMajor")),
                ("graduation_year", EducationField(p, "graduationYear")
                    ?? FirstNested(p, "profile", "bachelorYear") ?? ThanawiGraduationYear(p)),
                ("grade", EducationField(p, "grade") ?? FirstNested(p, "profile", "bachelorGrade", "thanawiGrade")),
                ("percentage", EducationField(p, "percentage")
                    ?? FirstNested(p, "profile", "bachelorPercentage", "thanawiPercentage")),
                ("school_name", SecondaryEducationField(p, "schoolName") ?? FirstNested(p, "profile", "schoolNameAr")),
                ("school_category", SecondaryEducationField(p, "schoolCategory", "branch")
                    ?? FirstNested(p, "profile", "thanawiType")),
                ("secondary_total_score", SecondaryEducationField(p, "totalScore")
                    ?? FirstNested(p, "profile", "thanawiTotal")),
                ("secondary_percentage", SecondaryEducationField(p, "percentage")
                    ?? FirstNested(p, "profile", "thanawiPercentage")),
                ("secondary_graduation_year", SecondaryEducationField(p, "graduationYear") ?? ThanawiGraduationYear(p)),
                ("category", CategoryKey(p)),
                ("cycle_id", FirstString(p, "cycleId", "admissionCycleId", "cycle_id") ?? cycleId),
                ("status", ApplicantField(p, "status"))), created, updated, nid));
        }
        return rows;
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedRelativesAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var applicants = await ctx.ApplicantsAsync();
        var rows = new List<CuratedRow>();
        foreach (var a in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(a)) continue;
            if (!IsApplicantInCycleScope(a, cycleId, ctx.ActiveCategoryKeys)) continue;
            if (!IsApplicantBooked(a)) continue;
            var nid = a["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            if (a["family"] is not JsonObject family) continue;
            var (created, updated) = Timestamps(a);
            var relativeSeq = 0;

            void Emit(string kinship, JsonObject? member)
            {
                if (member is null) return;
                var name = member["fullName"]?.ToString() ?? member["name"]?.ToString();
                var memberNid = member["nationalId"]?.ToString();
                if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(memberNid)) return;
                relativeSeq += 1;
                rows.Add(new CuratedRow(Cells(
                    // Stable per-row key: the member's own record id when stored,
                    // else applicant NID + deterministic emit position (the family
                    // payload is ordered, so re-exports keep the same ids).
                    ("relative_id", member["id"]?.ToString() ?? $"{nid}:{relativeSeq}"),
                    ("applicant_id", nid),
                    ("relation_type", kinship),
                    ("relation_label", member["relationshipId"]?.ToString() ?? RelationLabelAr(kinship)),
                    ("full_name", name),
                    ("national_id", memberNid),
                    ("gender", member["gender"]?.ToString()),
                    ("qualification", member["education"]?.ToString() ?? member["qualification"]?.ToString()),
                    ("occupation", member["occupation"]?.ToString()),
                    ("phone", member["mobile"]?.ToString() ?? member["phone"]?.ToString()),
                    ("governorate", member["governorate"]?.ToString()),
                    ("address", member["address"]?.ToString())), created, updated, nid));
            }

            Emit("father", family["father"] as JsonObject);
            Emit("mother", family["mother"] as JsonObject);
            Emit("paternal_grandfather", family["paternalGrandfather"] as JsonObject);
            Emit("paternal_grandmother", family["paternalGrandmother"] as JsonObject);
            Emit("maternal_grandfather", family["maternalGrandfather"] as JsonObject);
            Emit("maternal_grandmother", family["maternalGrandmother"] as JsonObject);
            Emit("guardian", family["guardian"] as JsonObject);
            foreach (var n in family["fatherWives"] as JsonArray ?? []) Emit("father_wife", n as JsonObject);
            foreach (var n in family["motherHusbands"] as JsonArray ?? []) Emit("mother_husband", n as JsonObject);
            foreach (var n in family["siblings"] as JsonArray ?? []) Emit(InferKinshipFromRelationship(n, "sibling"), n as JsonObject);
            foreach (var n in family["relatives"] as JsonArray ?? []) Emit(InferKinshipFromRelationship(n, "relative"), n as JsonObject);
        }
        return rows;
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedExamsAsync(string? cycleId, CancellationToken ct)
    {
        var exams = await db.Exams.AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(cycleId) || x.CycleId == cycleId)
            .ToListAsync(ct);
        return exams.Select(x => new CuratedRow(Cells(
            ("exam_id", x.Id),
            ("exam_name", x.NameAr),
            ("cycle_id", x.CycleId),
            ("scheduled_for", x.ScheduledFor),
            ("duration_minutes", x.DurationMinutes?.ToString(CultureInfo.InvariantCulture)),
            ("question_count", x.QuestionCount?.ToString(CultureInfo.InvariantCulture)),
            ("status", x.Status)), x.CreatedAt, x.UpdatedAt, null)).ToList();
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedExamSchedulesAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var resolver = await ctx.ExamResolverAsync();
        var rows = new List<CuratedRow>();
        foreach (var inst in ctx.CommitteeInstances)
        {
            if (AdminRecordJson.IsSoftDeleted(inst)) continue;
            if (!MatchesCycle(FirstString(inst, "cycleId", "admissionCycleId", "cycle_id"), cycleId)) continue;
            var code = FirstString(inst, "definitionCode", "committeeId", "committeeCode");
            var committeeName = code is not null && ctx.CommitteeDirectory.NameByCode.TryGetValue(code, out var n)
                ? n : FirstString(inst, "committeeName", "committeeLabelAr");
            var (examId, examName) = resolver.Resolve(inst);
            var (created, updated) = Timestamps(inst);
            rows.Add(new CuratedRow(Cells(
                ("slot_id", FirstString(inst, "id", "slotId")),
                ("exam_id", examId),
                ("exam_name", examName),
                ("category", CategoryKey(inst)),
                ("date", FirstString(inst, "date", "examDate", "scheduledDate")),
                ("committee_name", committeeName),
                ("capacity", FirstString(inst, "capacity", "maxCapacity")),
                ("reserved", FirstString(inst, "reserved", "reservedCount"))), created, updated, null));
        }

        IReadOnlyList<JsonObject> days;
        try { days = await records.ListAsync("admissionSetup.examScheduleDays", ct); }
        catch (InvalidOperationException) { days = []; }
        foreach (var d in days)
        {
            if (AdminRecordJson.IsSoftDeleted(d)) continue;
            if (!MatchesCycle(FirstString(d, "cycleId", "admissionCycleId", "cycle_id"), cycleId)) continue;
            var (examId, examName) = resolver.Resolve(d);
            var (created, updated) = Timestamps(d);
            rows.Add(new CuratedRow(Cells(
                ("slot_id", FirstString(d, "id", "dayId")),
                ("exam_id", examId),
                ("exam_name", examName),
                ("category", CategoryKey(d)),
                ("date", FirstString(d, "date", "examDate", "day")),
                ("committee_name", FirstString(d, "committeeName")),
                ("capacity", FirstString(d, "capacity", "maxCapacity")),
                ("reserved", FirstString(d, "reserved", "reservedCount"))), created, updated, null));
        }
        return rows;
    }

    /// <summary>Resolves the exam (code + readable name) for a curated export
    /// row. Explicit exam fields on the record win; otherwise the row's
    /// category falls back to the first exam of the cycle's ordered exam plan,
    /// and the name resolves through the tests lookup (code when unnamed).
    /// Mirrors how /admin/committees-exam-config labels instance rows.</summary>
    private sealed class CuratedExamResolver(
        IReadOnlyDictionary<string, string> nameByCode,
        IReadOnlyDictionary<string, string> firstPlannedByCategory)
    {
        public (string? ExamId, string? ExamName) Resolve(JsonObject row)
        {
            var examId = FirstString(row, "examPlanId", "planId", "examId")
                ?? (CategoryKey(row) is { } category ? firstPlannedByCategory.GetValueOrDefault(category) : null);
            var examName = FirstString(row, "examPlanName", "planName", "examName", "examPlanLabel")
                ?? (examId is null ? null : nameByCode.GetValueOrDefault(examId) ?? examId);
            return (examId, examName);
        }
    }

    private async Task<CuratedExamResolver> BuildCuratedExamResolverAsync(string? cycleId, CancellationToken ct)
        => new(await LoadExamNameByCodeAsync(ct), await LoadFirstPlannedExamByCategoryAsync(cycleId, ct));

    /// <summary>categoryKey → first exam code in the cycle's ordered exam plan
    /// (`examPlans` bucket). Committee instances don't link to a specific exam
    /// in the domain model — the management page (/admin/committees-exam-config)
    /// displays the first exam of the category's plan, and the ExamSchedules
    /// sheet mirrors that resolution so exam_id/exam_name are never empty.</summary>
    private async Task<IReadOnlyDictionary<string, string>> LoadFirstPlannedExamByCategoryAsync(string? cycleId, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        IReadOnlyList<JsonObject> plans;
        try { plans = await records.ListAsync("examPlans", ct); }
        catch (InvalidOperationException) { return map; }

        foreach (var plan in plans)
        {
            if (AdminRecordJson.IsSoftDeleted(plan)) continue;
            if (!MatchesCycle(FirstString(plan, "cycleId", "admissionCycleId", "cycle_id"), cycleId)) continue;
            var category = FirstString(plan, "categoryId", "categoryKey");
            if (string.IsNullOrWhiteSpace(category) || map.ContainsKey(category)) continue;
            var firstExamId = (plan["exams"] as JsonArray ?? [])
                .OfType<JsonObject>()
                .OrderBy(e => int.TryParse(e["order"]?.ToString(), out var order) ? order : int.MaxValue)
                .Select(e => FirstString(e, "examId", "id", "code"))
                .FirstOrDefault(id => !string.IsNullOrWhiteSpace(id));
            if (firstExamId is not null) map[category] = firstExamId;
        }
        return map;
    }

    /// <summary>One row per booked applicant's reserved exam appointment — the
    /// applicant ↔ slot link the ExamSchedules sheet (slots + counts) can't
    /// express. Committee + exam-plan names resolve through the committee
    /// instance matched by slot id, falling back to (category, date).</summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedExamReservationsAsync(
        string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var applicants = await ctx.ApplicantsAsync();
        var resolver = await ctx.ExamResolverAsync();
        var rows = new List<CuratedRow>();
        foreach (var a in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(a)) continue;
            if (!IsApplicantInCycleScope(a, cycleId, ctx.ActiveCategoryKeys)) continue;
            if (!IsApplicantBooked(a)) continue;
            var nid = a["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;

            var slot = a["examSlot"] as JsonObject;
            var slotId = FirstString(a, "examSlotId", "slotId")
                ?? (slot is null ? null : FirstString(slot, "slotId", "id"));
            var date = (slot is null ? null : FirstString(slot, "date"))
                ?? FirstString(a, "firstExamDate", "examDate", "examScheduledAt");
            var instance = FindCommitteeInstanceForApplicant(a, ctx.CommitteeInstances);
            // The matched instance's explicit exam fields win; an applicant with
            // no matched instance (or an instance carrying no exam/category data)
            // falls back to their own category's cycle plan, so every booked
            // applicant exports an exam_id + exam_name.
            var (examId, examName) = instance is null ? (null, null) : resolver.Resolve(instance);
            if (examId is null && examName is null) (examId, examName) = resolver.Resolve(a);
            var (created, updated) = Timestamps(a);
            rows.Add(new CuratedRow(Cells(
                ("applicant_national_id", nid),
                ("applicant_name", ApplicantField(a, "fullName", "name")),
                ("slot_id", slotId),
                ("exam_id", examId),
                ("exam_name", examName),
                ("appointment_date", date),
                ("appointment_time", (slot is null ? null : FirstString(slot, "time")) ?? DefaultExamScheduleTime),
                ("committee_name", OperationalRecordsService.ResolveCommitteeName(a, ctx.CommitteeDirectory, ctx.CommitteeInstances)),
                ("reservation_status", "محجوز")), created, updated, nid));
        }
        return rows;
    }

    /// <summary>Finds the committee-instance row backing an applicant's booked
    /// slot: exact slot-id match first, then (category, exam-date). Mirrors the
    /// matching in <see cref="ResolveCommitteeCodeFromSchedule"/> but returns
    /// the instance itself so callers can read its exam-plan fields.</summary>
    private static JsonObject? FindCommitteeInstanceForApplicant(
        JsonObject applicant, IReadOnlyList<JsonObject> committeeInstances)
    {
        var slotId = FirstString(applicant, "examSlotId", "slotId")
            ?? NestedStringProp(applicant, "examSlot", "slotId")
            ?? NestedStringProp(applicant, "examSlot", "id");
        if (!string.IsNullOrWhiteSpace(slotId))
        {
            var exact = committeeInstances.FirstOrDefault(instance =>
                TextEquals(FirstString(instance, "id", "slotId"), slotId));
            if (exact is not null) return exact;
        }

        var category = CategoryKey(applicant);
        var dateKey = DateKey(NestedStringProp(applicant, "examSlot", "date")
            ?? FirstString(applicant, "firstExamDate", "examDate", "scheduledDate", "examSlotDate"));
        if (string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(dateKey)) return null;
        return committeeInstances.FirstOrDefault(instance =>
            TextEquals(FirstString(instance, "categoryKey", "categoryId", "applicantCategory"), category) &&
            TextEquals(DateKey(FirstString(instance, "date", "examDate", "scheduledDate")), dateKey));
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedExamResultsAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var applicants = await ctx.ApplicantsAsync();
        var examNameByCode = await LoadExamNameByCodeAsync(ct);
        var rows = new List<CuratedRow>();
        foreach (var a in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(a)) continue;
            if (!IsApplicantInCycleScope(a, cycleId, ctx.ActiveCategoryKeys)) continue;
            if (!IsApplicantBooked(a)) continue;
            var nid = a["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            if (a["followUp"] is not JsonObject followUp || followUp.Count == 0) continue;
            var (created, updated) = Timestamps(a);
            var committee = OperationalRecordsService.ResolveCommitteeName(a, ctx.CommitteeDirectory, ctx.CommitteeInstances);
            var examDate = NestedStringProp(a, "examSlot", "date") ?? FirstString(a, "examDate");
            foreach (var (code, node) in followUp)
            {
                var outcome = node?.ToString();
                if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(outcome)) continue;
                rows.Add(new CuratedRow(Cells(
                    // followUp holds one outcome per exam code, so (NID, exam)
                    // is the natural unique row key.
                    ("result_id", $"{nid}:{code}"),
                    ("applicant_id", nid),
                    ("exam_id", code),
                    ("exam_name", examNameByCode.TryGetValue(code, out var en) ? en : code),
                    ("result", outcome),
                    ("score", null),
                    ("committee", committee),
                    ("exam_date", examDate)), created, updated, nid));
            }
        }
        return rows;
    }

    /// <summary>Curated وثيقة التعارف export — one row per (document, section)
    /// so the submitted section data ships alongside the workflow lifecycle.
    /// Documents with no sections still emit one row (lifecycle only). The
    /// revision columns summarize the doc's change history (count + latest).</summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedAcquaintanceDocsAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var docs = await db.ApplicantAcquaintanceDocs.AsNoTracking().ToListAsync(ct);
        if (docs.Count == 0) return [];
        var sections = await db.ApplicantAcquaintanceDocSections.AsNoTracking().ToListAsync(ct);
        var revisions = await db.ApplicantAcquaintanceDocRevisions.AsNoTracking().ToListAsync(ct);
        var sectionsByDoc = sections
            .GroupBy(s => s.AcquaintanceDocId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.OrderBy(s => s.SectionKey, StringComparer.Ordinal).ToList(), StringComparer.Ordinal);
        var revisionsByDoc = revisions
            .GroupBy(r => r.AcquaintanceDocId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.Version).ToList(), StringComparer.Ordinal);
        var nidById = await BuildApplicantNidByRecordIdAsync(cycleId, ctx);

        var rows = new List<CuratedRow>();
        foreach (var doc in docs)
        {
            if (BelongsToDifferentCycle(doc.CycleId, cycleId)) continue;
            if (!nidById.TryGetValue(doc.ApplicantId, out var nid)) continue;

            var docRevisions = revisionsByDoc.TryGetValue(doc.Id, out var revs) ? revs : [];
            var latestRevision = docRevisions.Count > 0 ? docRevisions[0] : null;
            var docSections = sectionsByDoc.TryGetValue(doc.Id, out var secs) ? secs : [];

            CuratedRow Row(string? sectionKey, string? sectionData) => new(Cells(
                // One row per (document, section): the doc id alone identifies
                // the lifecycle-only row; section rows suffix their section key.
                ("record_id", sectionKey is null ? doc.Id : $"{doc.Id}:{sectionKey}"),
                ("applicant_national_id", nid),
                ("cycle_id", doc.CycleId),
                ("doc_status", doc.Status),
                ("version", doc.Version.ToString(CultureInfo.InvariantCulture)),
                ("opened_at", DtoString(doc.OpenedAt)),
                ("closed_at", DtoString(doc.ClosedAt)),
                ("last_autosaved_at", DtoString(doc.LastAutosavedAt)),
                ("section_key", sectionKey),
                ("section_data", sectionData),
                ("revision_count", docRevisions.Count.ToString(CultureInfo.InvariantCulture)),
                ("last_revision_kind", latestRevision?.ChangeKind),
                ("last_revision_at", DtoString(latestRevision?.CreatedAt))), doc.CreatedAt, doc.UpdatedAt, nid);

            if (docSections.Count == 0)
            {
                rows.Add(Row(null, null));
                continue;
            }
            foreach (var section in docSections)
                rows.Add(Row(section.SectionKey, section.DataJson));
        }
        return rows;
    }

    /// <summary>Lookup-resolution maps shared by both condition planes:
    /// per-lookup-key code→Arabic-name, the applicant-categories lookup
    /// payloads (excellence criteria, min-age, gender scope), and category
    /// code→label.</summary>
    private sealed record ConditionNames(
        IReadOnlyDictionary<string, Dictionary<string, string>> ByLookupKey,
        IReadOnlyDictionary<string, JsonObject> CategoryLookups,
        IReadOnlyDictionary<string, string> CategoryNames);

    /// <summary>
    /// Admission conditions live on TWO planes (the same two the eligibility
    /// engine reads — <see cref="Admissions.Eligibility.ApplicantEligibilityService"/>):
    ///  1. The admission-setup wizard cycle-draft
    ///     (`admissionSetup.applicationSettings.{cycleId}`, `approved` +
    ///     `local` buckets) — where the «شروط اللجنة» rows are authored.
    ///     This is the ONLY cycle-scoped source, so when the selected cycle
    ///     has a draft it is exported alone.
    ///  2. The normalized application-settings tables (category configs →
    ///     specializations → graduation-year rows). They carry no cycle
    ///     column and accumulate rows across cycles, so they are a fallback
    ///     for active/unspecified cycles with no draft — exporting them next
    ///     to a draft duplicated categories with stale old-cycle conditions.
    /// Lookup codes (marital status, school category, division, grades,
    /// degrees, excellence criteria, exam rounds, committees) resolve to their
    /// Arabic names; unknown codes pass through as-is.
    /// </summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedAdmissionConditionsAsync(
        string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var byLookupKey = await LoadLookupNamesByKeyAsync(ct);
        var categoryLookups = await LoadCategoryLookupPayloadsAsync(ct);
        var categoryNames = await db.ApplicantCategories.AsNoTracking()
            .ToDictionaryAsync(c => c.Key, c => c.LabelAr, StringComparer.OrdinalIgnoreCase, ct);
        foreach (var (code, payload) in categoryLookups)
        {
            if (!categoryNames.ContainsKey(code) && AdminRecordJson.StringProp(payload, "name") is { } name)
                categoryNames[code] = name;
        }
        var names = new ConditionNames(byLookupKey, categoryLookups, categoryNames);

        // cycleId arrives pre-resolved: ResolveCycleIdAsync defaults a blank
        // request to the active cycle, so blank here means "no active cycle".
        var draftRows = await LoadDraftConditionRowsAsync(cycleId, names, ctx, ct);
        if (draftRows.Count > 0)
        {
            var rows = new List<CuratedRow>(draftRows);
            rows.AddRange(await LoadCategoryBaselineRowsAsync(names, draftRows, ctx, ct));
            return rows;
        }

        var includeNormalized = string.IsNullOrWhiteSpace(cycleId)
            || string.IsNullOrWhiteSpace(ctx.ActiveCycleId)
            || string.Equals(cycleId, ctx.ActiveCycleId, StringComparison.OrdinalIgnoreCase);
        return includeNormalized ? await LoadNormalizedConditionRowsAsync(names, ct) : [];
    }

    /// <summary>A configured category with no authored condition row still
    /// surfaces (empty condition cells) so the sheet lists every category in
    /// the cycle's scope — without dragging in old-cycle graduation-year rows
    /// from the cycle-less normalized tables.</summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadCategoryBaselineRowsAsync(
        ConditionNames names, IReadOnlyList<CuratedRow> draftRows, CuratedContext ctx, CancellationToken ct)
    {
        var covered = new HashSet<string>(
            draftRows.Select(r => r.Cells.GetValueOrDefault("category")).OfType<string>(),
            StringComparer.OrdinalIgnoreCase);
        var configs = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().ToListAsync(ct);
        var rows = new List<CuratedRow>();
        foreach (var config in configs.OrderBy(c => c.SortOrder))
        {
            if (covered.Contains(config.CategoryId)) continue;
            if (ctx.ActiveCategoryKeys is not null && !ctx.ActiveCategoryKeys.Contains(config.CategoryId)) continue;
            rows.Add(new CuratedRow(Cells(
                ("condition_id", config.Id),
                ("category", config.CategoryId),
                ("category_name", names.CategoryNames.GetValueOrDefault(config.CategoryId)),
                ("excellence_criterion", ResolveCategoryExcellence(config.CategoryId, names)),
                ("condition_status", "معتمد"),
                ("is_active", config.IsActive ? "true" : "false")), config.CreatedAt, config.UpdatedAt, null));
        }
        return rows;
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadNormalizedConditionRowsAsync(
        ConditionNames names, CancellationToken ct)
    {
        var configs = await db.ApplicationSettingsCategoryConfigs.AsNoTracking().ToListAsync(ct);
        if (configs.Count == 0) return [];
        var specs = await db.ApplicationSettingsCategorySpecializations.AsNoTracking().ToListAsync(ct);
        var years = await db.ApplicationSettingsGraduationYears.AsNoTracking().ToListAsync(ct);
        var specsByConfig = specs
            .GroupBy(s => s.ConfigId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);
        var yearsBySpec = years
            .GroupBy(y => y.CategorySpecializationId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);
        var facultyBySpec = await LoadFacultyBySpecializationAsync(ct);

        var rows = new List<CuratedRow>();
        foreach (var config in configs.OrderBy(c => c.SortOrder))
        {
            var categoryName = names.CategoryNames.GetValueOrDefault(config.CategoryId);
            var excellence = ResolveCategoryExcellence(config.CategoryId, names);
            var attachedSpecs = specsByConfig.TryGetValue(config.Id, out var specList)
                ? specList : [];

            CuratedRow Baseline(string conditionId, string? facultyName, string? specName, bool isActive,
                DateTimeOffset created, DateTimeOffset updated) => new(Cells(
                ("condition_id", conditionId),
                ("category", config.CategoryId),
                ("category_name", categoryName),
                ("faculty", facultyName),
                ("specialization", specName),
                ("excellence_criterion", excellence),
                ("condition_status", "معتمد"),
                ("is_active", isActive ? "true" : "false")), created, updated, null);

            // A configured category with no attached specializations (or with
            // specializations but no condition rows yet) still surfaces — the
            // export must list EVERY configured category, not only those whose
            // admission conditions are fully authored.
            if (attachedSpecs.Count == 0)
            {
                rows.Add(Baseline(config.Id, null, null, config.IsActive, config.CreatedAt, config.UpdatedAt));
                continue;
            }

            foreach (var spec in attachedSpecs)
            {
                var isImplicit = string.Equals(
                    spec.SpecializationId, ApplicationSettingsService.ImplicitDefaultSpecCode, StringComparison.Ordinal);
                var specName = isImplicit ? null : ResolveName(names, "specializations", spec.SpecializationId);
                var facultyCode = isImplicit ? null : facultyBySpec.GetValueOrDefault(spec.SpecializationId);
                var facultyName = facultyCode is null ? null : ResolveName(names, "faculties", facultyCode);
                var specYears = yearsBySpec.TryGetValue(spec.Id, out var yearList) ? yearList : [];
                if (specYears.Count == 0)
                {
                    rows.Add(Baseline(spec.Id, facultyName, specName, config.IsActive && spec.IsActive, spec.CreatedAt, spec.UpdatedAt));
                    continue;
                }

                foreach (var y in specYears)
                {
                    var isTagdir = string.Equals(y.GradeKind, "TAGDIR", StringComparison.OrdinalIgnoreCase);
                    var gradYears = ParseJsonArrayItems(y.GraduationYearsJson);
                    var perYear = gradYears.Count == 0 ? new List<string?> { null } : gradYears.Cast<string?>().ToList();
                    foreach (var gradYear in perYear)
                    {
                        rows.Add(new CuratedRow(Cells(
                            // A year row fans out per graduation year — suffix
                            // keeps each exported row's key unique.
                            ("condition_id", gradYear is null ? y.Id : $"{y.Id}:{gradYear}"),
                            ("category", config.CategoryId),
                            ("category_name", categoryName),
                            ("faculty", facultyName),
                            ("specialization", specName),
                            ("graduation_year", gradYear),
                            ("gender", JoinJsonArray(y.GenderTypesJson)),
                            ("marital_status", ResolveNames(names, "marital-statuses", ParseJsonArrayItems(y.MaritalStatusCodesJson))),
                            ("min_age", y.AgeMin?.ToString(CultureInfo.InvariantCulture)),
                            ("max_age", y.MaxAge?.ToString(CultureInfo.InvariantCulture)),
                            ("age_reference_date", y.AgeReferenceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                            ("min_percentage", isTagdir ? null : y.MinPercentage?.ToString(CultureInfo.InvariantCulture)),
                            ("min_grade", isTagdir ? ResolveName(names, "academic-grades", y.AcademicGradeId) : null),
                            ("division", ResolveNames(names, "applicant-divisions", ParseJsonArrayItems(y.DivisionCodesJson))),
                            ("school_category", ResolveNames(names, "school-categories", ParseJsonArrayItems(y.SchoolCategoryCodesJson))),
                            ("excellence_criterion", excellence),
                            ("application_start_date", y.ApplicationStartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                            ("application_end_date", y.ApplicationEndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                            ("condition_status", "معتمد"),
                            ("is_active", config.IsActive && spec.IsActive && y.IsActive ? "true" : "false")), y.CreatedAt, y.UpdatedAt, null));
                    }
                }
            }
        }
        return rows;
    }

    /// <summary>The wizard's authored «شروط اللجنة» rows from the cycle draft.
    /// `approved` rows are the committed conditions; `local` rows are
    /// not-yet-approved drafts the eligibility engine also honors — both are
    /// exported, distinguished by `condition_status`.</summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadDraftConditionRowsAsync(
        string? cycleId, ConditionNames names, CuratedContext ctx, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cycleId)) return [];
        var module = $"admissionSetup.applicationSettings.{cycleId}";
        JsonObject? draft;
        try { draft = await records.GetAsync(module, module, ct); }
        catch (InvalidOperationException) { return []; }
        if (draft is null) return [];

        var (draftCreated, draftUpdated) = Timestamps(draft);
        var rows = new List<CuratedRow>();
        foreach (var (bucket, statusAr) in new[] { ("approved", "معتمد"), ("local", "مسودة") })
        {
            var bucketRows = (draft[bucket] as JsonArray ?? []).OfType<JsonObject>().ToList();
            for (var i = 0; i < bucketRows.Count; i += 1)
            {
                // Wizard rows carry their own id; the bucket+position fallback
                // keeps id-less legacy rows unique and stable across re-exports.
                var conditionId = FirstString(bucketRows[i], "id", "rowId") ?? $"{cycleId}:{bucket}:{i + 1}";
                rows.AddRange(DraftConditionRows(bucketRows[i], conditionId, statusAr, names, ctx, draftCreated, draftUpdated));
            }
        }
        return rows;
    }

    private static IEnumerable<CuratedRow> DraftConditionRows(
        JsonObject row,
        string conditionId,
        string statusAr,
        ConditionNames names,
        CuratedContext ctx,
        DateTimeOffset draftCreated,
        DateTimeOffset draftUpdated)
    {
        var categoryCode = FirstString(row, "categoryCode", "categoryId") ?? "";
        names.CategoryLookups.TryGetValue(categoryCode, out var categoryLookup);
        var header = row["header"] as JsonObject ?? [];

        var maritalCodes = StringItems(row["maritalStatus"]);
        if (maritalCodes.Count == 0) maritalCodes = StringItems(header["maritalStatus"]);
        // Thanawi rows carry an empty `type` by design — gender comes from the
        // category's scope, the same fallback the eligibility engine applies.
        var genderCodes = StringItems(row["type"]);
        if (genderCodes.Count == 0 && categoryLookup is not null) genderCodes = StringItems(categoryLookup["genderScope"]);
        var committeeCodes = StringItems(row["committees"]);
        if (committeeCodes.Count == 0 && FirstString(row, "committee") is { } single) committeeCodes = [single];
        var committeeNames = committeeCodes
            .Select(code => ctx.CommitteeDirectory.NameByCode.GetValueOrDefault(code) ?? ResolveName(names, "committees", code))
            .OfType<string>().ToList();

        var created = ParseDto(row["createdAt"]) ?? draftCreated;
        var gradYears = StringItems(row["graduationYears"]);
        if (gradYears.Count == 0 && FirstString(row, "graduationYear") is { } year) gradYears = [year];
        var perYear = gradYears.Count == 0 ? [null] : gradYears.Cast<string?>().ToList();

        foreach (var gradYear in perYear)
        {
            yield return new CuratedRow(Cells(
                // A wizard row fans out per graduation year — suffix keeps each
                // exported row's key unique.
                ("condition_id", gradYear is null ? conditionId : $"{conditionId}:{gradYear}"),
                ("category", categoryCode),
                ("category_name", names.CategoryNames.GetValueOrDefault(categoryCode)),
                ("faculty", FirstString(row, "facultyNameAr") ?? ResolveName(names, "faculties", FirstString(row, "facultyCode"))),
                ("specialization", FirstString(row, "specializationNameAr")
                    ?? ResolveName(names, "specializations", FirstString(row, "specializationCode"))),
                ("academic_degree", ResolveNames(names, "academic-degrees", StringItems(row["academicDegrees"]))),
                ("graduation_year", gradYear),
                ("gender", JoinItems(genderCodes)),
                ("marital_status", ResolveNames(names, "marital-statuses", maritalCodes)),
                ("min_age", categoryLookup is null ? null : AdminRecordJson.StringProp(categoryLookup, "minAge")),
                ("max_age", FirstString(header, "maxAge")),
                ("age_reference_date", FirstString(header, "ageReferenceDate")),
                ("min_percentage", FirstString(row, "scoreMin")),
                ("max_percentage", FirstString(row, "scoreMax")),
                ("min_grade", ResolveName(names, "academic-grades", FirstString(row, "grade"))),
                ("max_grade", ResolveName(names, "academic-grades", FirstString(row, "gradeMax"))),
                ("school_category", ResolveNames(names, "school-categories", StringItems(row["schoolCategories"]))),
                ("exam_round", ResolveName(names, "exam-rounds", FirstString(row, "examRound"))),
                ("committee", JoinItems(committeeNames)),
                ("excellence_criterion", ResolveName(names, "excellence-criteria", FirstString(row, "excellenceMode"))
                    ?? ResolveCategoryExcellence(categoryCode, names)),
                ("application_start_date", FirstString(header, "applicationStart")),
                ("application_end_date", FirstString(header, "applicationEnd")),
                ("condition_status", statusAr),
                ("is_active", "true")), created, draftUpdated, null);
        }
    }

    private async Task<IReadOnlyDictionary<string, Dictionary<string, string>>> LoadLookupNamesByKeyAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking().ToListAsync(ct);
        var map = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            if (!map.TryGetValue(row.LookupKey, out var byCode))
            {
                byCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                map[row.LookupKey] = byCode;
            }
            byCode.TryAdd(row.Code, row.Name);
        }
        return map;
    }

    private async Task<IReadOnlyDictionary<string, JsonObject>> LoadCategoryLookupPayloadsAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "applicant-categories").ToListAsync(ct);
        var map = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            var payload = ParseObject(row.PayloadJson);
            payload["name"] ??= row.Name;
            map[row.Code] = payload;
        }
        return map;
    }

    private static string? ResolveCategoryExcellence(string categoryCode, ConditionNames names)
        => names.CategoryLookups.TryGetValue(categoryCode, out var payload)
            ? ResolveNames(names, "excellence-criteria", StringItems(payload["excellenceCriterion"]))
            : null;

    private static string? ResolveName(ConditionNames names, string lookupKey, string? code)
        => string.IsNullOrWhiteSpace(code)
            ? null
            : names.ByLookupKey.TryGetValue(lookupKey, out var byCode) ? byCode.GetValueOrDefault(code, code) : code;

    private static string? ResolveNames(ConditionNames names, string lookupKey, IReadOnlyList<string> codes)
        => JoinItems(codes.Select(code => ResolveName(names, lookupKey, code)).OfType<string>().ToList());

    private static string? JoinItems(IReadOnlyList<string> items)
        => items.Count == 0 ? null : string.Join(", ", items);

    private static List<string> StringItems(JsonNode? node)
    {
        var result = new List<string>();
        if (node is not JsonArray array) return result;
        foreach (var item in array)
        {
            var s = item?.ToString();
            if (!string.IsNullOrWhiteSpace(s)) result.Add(s);
        }
        return result;
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedLookupRowsAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking().ToListAsync(ct);
        return rows.Select(x => new CuratedRow(Cells(
            // lookup_rows has a composite PK — (lookup_key, code) joined is the
            // stable single-column row identifier the export rule requires.
            ("lookup_row_id", $"{x.LookupKey}:{x.Code}"),
            ("lookup_key", x.LookupKey),
            ("code", x.Code),
            ("name", x.Name),
            ("is_active", x.IsActive ? "true" : "false")), x.CreatedAt, x.UpdatedAt, null)).ToList();
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedGeneralSettingsAsync(CancellationToken ct)
    {
        var s = await db.GeneralSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (s is null) return [];
        return [new CuratedRow(Cells(
            ("settings_id", s.Id),
            ("exam_days_per_applicant", s.ExamDaysPerApplicant.ToString(CultureInfo.InvariantCulture)),
            ("exam_slot_selection_window_days", s.ExamSlotSelectionWindowDays.ToString(CultureInfo.InvariantCulture)),
            ("acquaintance_documents_open_timing", s.AcquaintanceDocumentsOpenTiming),
            ("acquaintance_documents_close_timing", s.AcquaintanceDocumentsCloseTiming)), s.CreatedAt, s.UpdatedAt, null)];
    }

    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedOperationalAsync<TEntity>(
        DbSet<TEntity> set, string? cycleId,
        Func<TEntity, JsonObject, Dictionary<string, string?>> project, CancellationToken ct)
        where TEntity : OperationalRecordEntity
    {
        var hasCycle = !string.IsNullOrWhiteSpace(cycleId);
        var list = await set.AsNoTracking()
            .Where(x => !hasCycle || x.CycleId == null || x.CycleId == cycleId)
            .ToListAsync(ct);
        return list.Select(x =>
        {
            var payload = ParseObject(x.PayloadJson);
            return new CuratedRow(project(x, payload), x.CreatedAt, x.UpdatedAt, x.NationalId ?? x.ApplicantId);
        }).ToList();
    }

    private static Dictionary<string, string?> ProjectPaymentRow(PaymentRecordEntity x, JsonObject p) => Cells(
        ("applicant_id", x.ApplicantId ?? x.NationalId),
        ("payment_id", x.Id),
        ("national_id", x.NationalId ?? AdminRecordJson.StringProp(p, "nationalId")),
        ("applicant_name", FirstString(p, "applicantName", "name", "fullName")),
        ("amount", AdminRecordJson.StringProp(p, "amount") ?? AdminRecordJson.StringProp(p, "value")),
        ("payment_status", x.Status ?? AdminRecordJson.StringProp(p, "status")),
        ("payment_method", FirstString(p, "method", "paymentMethod")),
        ("payment_date", DtoString(x.OccurredAt) ?? AdminRecordJson.StringProp(p, "paidAt") ?? AdminRecordJson.StringProp(p, "date")),
        ("fawry_reference", FirstString(p, "fawryReference", "refNumber")),
        ("cycle_id", x.CycleId));

    /// <summary>
    /// Payments merge THREE sources so every paid applicant exports exactly once:
    ///  1. The durable operational `payments` rows (admin ledger mutations).
    ///  2. The applicant-portal payment records (`applicant_portal_records`,
    ///     type = 'payment', successful only) — the same merge the
    ///     /admin/payments ledger renders (<see cref="Payments.PaymentsLedgerService"/>).
    ///     Real applicant payments are written here; reading the durable table
    ///     alone exported an empty sheet.
    ///  3. The applicant draft's `payment` snapshot — fallback for applicants
    ///     whose draft says paid but whose portal payment record is missing or
    ///     stuck `pending` (ConfirmPayment updates the FIRST record by
    ///     applicant, so an older attempt can shadow the confirmed one).
    /// Rows dedupe by Fawry reference across all sources; source 3 additionally
    /// dedupes by applicant. Cycle scoping is lenient — a payment whose
    /// applicant carries no cycle id is never dropped.
    /// </summary>
    private async Task<IReadOnlyList<CuratedRow>> LoadCuratedPaymentsAsync(string? cycleId, CuratedContext ctx, CancellationToken ct)
    {
        var rows = new List<CuratedRow>(
            await LoadCuratedOperationalAsync(db.PaymentRecords, cycleId, ProjectPaymentRow, ct));
        var seenReferences = rows
            .Select(r => r.Cells.GetValueOrDefault("fawry_reference") ?? r.Cells.GetValueOrDefault("payment_id"))
            .OfType<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var seenApplicants = rows
            .SelectMany(r => new[] { r.Cells.GetValueOrDefault("applicant_id"), r.Cells.GetValueOrDefault("national_id") })
            .OfType<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var applicants = await ctx.ApplicantsAsync();
        var applicantByKey = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
        foreach (var applicant in applicants)
        {
            foreach (var key in (string[])["id", "applicantId", "nationalId"])
            {
                var value = FirstString(applicant, key);
                if (value is not null) applicantByKey[value] = applicant;
            }
        }

        var portalPayments = await db.ApplicantPortalRecords.AsNoTracking()
            .Where(x => x.Type == "payment")
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync(ct);
        foreach (var record in portalPayments)
        {
            var payload = ParseObject(record.PayloadJson);
            var status = FirstString(payload, "status");
            var isPaid = string.Equals(status, "success", StringComparison.OrdinalIgnoreCase)
                || string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase);
            if (!isPaid) continue;

            var reference = FirstString(payload, "refNumber") ?? record.RecordId;
            if (!seenReferences.Add(reference)) continue;

            var applicantId = FirstString(payload, "applicantId") ?? record.ApplicantId;
            applicantByKey.TryGetValue(applicantId, out var applicant);
            var rowCycle = applicant is null ? null : FirstString(applicant, "cycleId", "admissionCycleId");
            if (CycleMismatch(rowCycle, cycleId)) continue;
            var nationalId = applicant is null ? null : FirstString(applicant, "nationalId");
            seenApplicants.Add(applicantId);
            if (nationalId is not null) seenApplicants.Add(nationalId);

            rows.Add(new CuratedRow(Cells(
                ("applicant_id", applicantId),
                ("payment_id", $"PAY-{reference}"),
                ("national_id", nationalId ?? applicantId),
                ("applicant_name", applicant is null ? null : FirstString(applicant, "fullName", "name", "applicantName")),
                ("amount", FirstString(payload, "amount")),
                ("payment_status", "paid"),
                ("payment_method", FirstString(payload, "method")),
                ("payment_date", DtoString(UnixOrIsoInstant(payload, "paidAt")) ?? DtoString(record.UpdatedAt)),
                ("fawry_reference", reference),
                ("cycle_id", rowCycle)), record.CreatedAt, record.UpdatedAt, nationalId ?? applicantId));
        }

        foreach (var applicant in applicants)
        {
            var row = DraftPaymentRow(applicant, cycleId, seenReferences, seenApplicants);
            if (row is null) continue;
            rows.Add(row);
            if (row.Cells.GetValueOrDefault("fawry_reference") is { } reference) seenReferences.Add(reference);
            if (row.Cells.GetValueOrDefault("applicant_id") is { } id) seenApplicants.Add(id);
            if (row.Cells.GetValueOrDefault("national_id") is { } nid) seenApplicants.Add(nid);
        }

        return rows;
    }

    /// <summary>Source-3 fallback row off the applicant draft's `payment`
    /// snapshot. Pure query — returns null when the applicant isn't paid, is
    /// already covered by a ledger/portal row, or falls outside the cycle
    /// scope; the caller registers the emitted row's dedup keys.</summary>
    private static CuratedRow? DraftPaymentRow(
        JsonObject applicant, string? cycleId, IReadOnlySet<string> seenReferences, IReadOnlySet<string> seenApplicants)
    {
        if (AdminRecordJson.IsSoftDeleted(applicant)) return null;
        var payment = applicant["payment"] as JsonObject;
        var isPaid = payment is not null
            || string.Equals(FirstString(applicant, "paymentStatus"), "paid", StringComparison.OrdinalIgnoreCase);
        if (!isPaid) return null;

        var applicantId = FirstString(applicant, "id", "applicantId");
        var nationalId = FirstString(applicant, "nationalId");
        var personKey = nationalId ?? applicantId;
        if (personKey is null) return null;
        if (applicantId is not null && seenApplicants.Contains(applicantId)) return null;
        if (nationalId is not null && seenApplicants.Contains(nationalId)) return null;

        var reference = payment is null ? null : FirstString(payment, "refNumber", "fawryCode");
        if (reference is not null && seenReferences.Contains(reference)) return null;

        var rowCycle = FirstString(applicant, "cycleId", "admissionCycleId");
        if (CycleMismatch(rowCycle, cycleId)) return null;

        var (created, updated) = Timestamps(applicant);
        return new CuratedRow(Cells(
            ("applicant_id", applicantId ?? nationalId),
            ("payment_id", $"PAY-{reference ?? personKey}"),
            ("national_id", personKey),
            ("applicant_name", FirstString(applicant, "fullName", "name", "applicantName")),
            ("amount", payment is null ? null : FirstString(payment, "amount")),
            ("payment_status", "paid"),
            ("payment_method", payment is null ? null : FirstString(payment, "method")),
            ("payment_date", payment is null ? null : DtoString(UnixOrIsoInstant(payment, "paidAt"))),
            ("fawry_reference", reference),
            ("cycle_id", rowCycle)), created, updated, personKey);
    }

    /// <summary>Lenient cycle scope: only a row that names a DIFFERENT cycle is
    /// excluded — blank/unknown cycle ids stay in so no payment is dropped.</summary>
    private static bool CycleMismatch(string? rowCycle, string? cycleId)
        => !string.IsNullOrWhiteSpace(cycleId)
            && !string.IsNullOrWhiteSpace(rowCycle)
            && !string.Equals(rowCycle, cycleId, StringComparison.OrdinalIgnoreCase);

    /// <summary>Portal payment timestamps are Unix-milliseconds numbers; durable
    /// rows carry ISO strings. Accepts both.</summary>
    private static DateTimeOffset? UnixOrIsoInstant(JsonObject payload, string key)
    {
        if (!payload.TryGetPropertyValue(key, out var node) || node is null) return null;
        if (node is JsonValue value && value.TryGetValue<long>(out var ms) && ms > 0)
        {
            try { return DateTimeOffset.FromUnixTimeMilliseconds(ms); }
            catch (ArgumentOutOfRangeException) { return null; }
        }
        return ParseDto(node);
    }

    private async Task<ExportInfoDto> BuildExportInfoAsync(string? cycleId, DateTimeOffset watermark, CancellationToken ct)
    {
        string? cycleName = null;
        if (!string.IsNullOrWhiteSpace(cycleId))
        {
            cycleName = await db.AdmissionCycles.AsNoTracking()
                .Where(c => c.Id == cycleId).Select(c => c.NameAr).FirstOrDefaultAsync(ct);
        }
        return new ExportInfoDto(
            cycleId,
            cycleName,
            watermark.ToString("O", CultureInfo.InvariantCulture),
            actor.CurrentActorId,
            hostEnvironment.EnvironmentName);
    }

    private async Task<IReadOnlyDictionary<string, string>> LoadExamNameByCodeAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var rows = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "tests" || x.LookupKey == "exam-plan-tests" || x.LookupKey == "test-results")
            .ToListAsync(ct);
        foreach (var r in rows) map.TryAdd(r.Code, r.Name);
        return map;
    }

    private async Task<IReadOnlyDictionary<string, string>> LoadFacultyBySpecializationAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking().Where(x => x.LookupKey == "specializations").ToListAsync(ct);
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
        {
            var fc = AdminRecordJson.StringProp(ParseObject(r.PayloadJson), "facultyCode");
            if (!string.IsNullOrWhiteSpace(fc)) map[r.Code] = fc;
        }
        return map;
    }

    private static string? ApplicantField(JsonObject p, params string[] keys)
        => FirstString(p, keys) ?? FirstNested(p, "profile", keys);

    /// <summary>Reads a field off the projected `education` object — for higher
    /// education the root carries the bachelor fields; for the pre-university
    /// (general) kind the root carries the secondary-certificate fields.</summary>
    private static string? EducationField(JsonObject p, params string[] keys)
        => p["education"] is JsonObject education ? FirstString(education, keys) : null;

    /// <summary>Reads a secondary-school field: the nested `education.secondary`
    /// branch for higher-education applicants, falling back to the education
    /// root for the general (pre-university) kind, whose school fields live there.</summary>
    private static string? SecondaryEducationField(JsonObject p, params string[] keys)
    {
        if (p["education"] is not JsonObject education) return null;
        if (education["secondary"] is JsonObject secondary)
        {
            var nested = FirstString(secondary, keys);
            if (!string.IsNullOrWhiteSpace(nested)) return nested;
        }
        return string.Equals(education["kind"]?.ToString(), "general", StringComparison.Ordinal)
            ? FirstString(education, keys)
            : null;
    }

    /// <summary>Secondary-certificate graduation year from the raw portal profile —
    /// the year component of `thanawiGradDate`, matching how the management
    /// projection derives it. Fallback for payloads without an `education` object.</summary>
    private static string? ThanawiGraduationYear(JsonObject p)
    {
        var raw = FirstNested(p, "profile", "thanawiGradDate");
        return raw is not null
            && DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed.Year.ToString(CultureInfo.InvariantCulture)
            : null;
    }

    private static string? FirstNested(JsonObject p, string parent, params string[] keys)
    {
        if (p[parent] is not JsonObject child) return null;
        foreach (var k in keys)
        {
            var s = AdminRecordJson.StringProp(child, k);
            if (!string.IsNullOrWhiteSpace(s)) return s;
        }
        return null;
    }

    private static (DateTimeOffset Created, DateTimeOffset Updated) Timestamps(JsonObject p)
    {
        var created = ParseDto(p["createdAt"] ?? p["created_at"]) ?? default;
        var updated = ParseDto(p["updatedAt"] ?? p["updated_at"]) ?? created;
        return (created, updated);
    }

    private static Dictionary<string, string?> Cells(params (string Key, string? Value)[] pairs)
    {
        var dict = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var (k, v) in pairs) dict[k] = v;
        return dict;
    }

    private static string? DtoString(DateTimeOffset? dto) => dto?.ToString("O", CultureInfo.InvariantCulture);

    private static string? RelationLabelAr(string kinship) => kinship switch
    {
        "father" => "الأب",
        "mother" => "الأم",
        "guardian" => "ولي الأمر",
        "paternal_grandfather" => "الجد لأب",
        "paternal_grandmother" => "الجدة لأب",
        "maternal_grandfather" => "الجد لأم",
        "maternal_grandmother" => "الجدة لأم",
        "father_wife" => "زوجة الأب",
        "mother_husband" => "زوج الأم",
        "brother" => "الأخ",
        "sister" => "الأخت",
        "paternal_uncle" => "العم",
        "paternal_aunt" => "العمة",
        "maternal_uncle" => "الخال",
        "maternal_aunt" => "الخالة",
        "sibling" => "شقيق",
        "relative" => "قريب",
        _ => null,
    };

    private static string? JoinJsonArray(string json)
    {
        var items = ParseJsonArrayItems(json);
        return items.Count == 0 ? null : string.Join(", ", items);
    }

    private static IReadOnlyList<string> ParseJsonArrayItems(string json)
    {
        var result = new List<string>();
        JsonNode? node;
        try { node = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json); }
        catch (JsonException) { return result; }
        if (node is JsonArray arr)
        {
            foreach (var el in arr)
                if (el is not null) result.Add(el.ToString());
        }
        return result;
    }
}

public enum ExportFilterKind { All, ChangedAfter, ModifiedSinceCreation, SinceLastExport }

public sealed record ExportFilter(
    ExportFilterKind Kind,
    DateTimeOffset? ChangedAfter,
    DateTimeOffset? LastExportAt,
    IReadOnlySet<string>? NationalIds = null,
    string? CycleId = null)
{
    public static readonly ExportFilter Default = new(ExportFilterKind.All, null, null, null, null);
}
