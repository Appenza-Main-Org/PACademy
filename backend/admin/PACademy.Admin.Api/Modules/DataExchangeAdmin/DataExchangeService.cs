using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
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
    IChangeTrackingActorProvider actor)
{
    // Read/write doc-store domains through OperationalRecordsService — the facade
    // ApplicantsController uses. It routes `applicants` to the core dbo.applicants
    // projection and other modules to their normalized operational tables.

    private const string Module = "data-exchange";
    private const string ImportSource = "data-exchange-import";
    private const string AuditEntityType = "data-exchange";

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
    public async Task<ExportResultDto> ExportAsync(
        IReadOnlyList<ExchangeDomain> domains, string layout, ExportFilter filter, CancellationToken ct)
    {
        var sheets = new List<ExportSheetDto>();
        var total = 0;
        foreach (var domain in domains)
        {
            var spec = DataExchangeRegistry.ByDomain[domain];
            var rows = ApplyFilter(await LoadAsync(spec, ct), filter);
            var dataColumns = UnionDataColumns(rows);
            var columns = ComposeColumns(dataColumns);
            var rowDicts = rows.Select(r => ToFullDict(r, dataColumns)).ToList();
            total += rowDicts.Count;
            sheets.Add(new ExportSheetDto(spec.Domain.ToString(), spec.SheetName, spec.TitleAr, columns, rowDicts));
        }

        var watermark = DateTimeOffset.UtcNow;
        await EmitAuditAsync("export", $"تصدير {sheets.Count} ورقة · {total} صف",
            total, 0, 0, 0, 0, ct);

        return new ExportResultDto(layout, watermark.ToString("O", CultureInfo.InvariantCulture), total, sheets);
    }

    private static IReadOnlyList<LoadedRow> ApplyFilter(IReadOnlyList<LoadedRow> rows, ExportFilter filter)
    {
        // Date-based / watermark filters first…
        var dateScoped = filter.Kind switch
        {
            ExportFilterKind.ChangedAfter => rows.Where(r => filter.ChangedAfter is { } d && r.UpdatedAt >= d).ToList(),
            ExportFilterKind.ModifiedSinceCreation => rows.Where(r => r.UpdatedAt != r.CreatedAt).ToList(),
            ExportFilterKind.SinceLastExport => filter.LastExportAt is { } w
                ? rows.Where(r => r.UpdatedAt >= w).ToList() : rows,
            _ => rows,
        };
        // …then the admin's per-row selection (national-id allow-list) when present.
        // BusinessKey for Applicants == nationalId (DataExchangeRegistry / BusinessKeyFields=["nationalId"]).
        if (filter.NationalIds is { Count: > 0 } allow)
        {
            return dateScoped.Where(r => allow.Contains(r.BusinessKey)).ToList();
        }
        return dateScoped;
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
    public async Task<IReadOnlyList<ApplicantRosterRow>> ListBookedApplicantsAsync(CancellationToken ct)
    {
        IReadOnlyList<JsonObject> payloads;
        try { payloads = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return []; }

        var committeeNameByCode = await db.LookupRows.AsNoTracking()
            .Where(x => x.LookupKey == "committees")
            .ToDictionaryAsync(x => x.Code, x => x.Name, StringComparer.OrdinalIgnoreCase, ct);

        var roster = new List<ApplicantRosterRow>(payloads.Count);
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
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
                CommitteeName: ResolveCommitteeName(payload, committeeNameByCode),
                ExamSlotLocation: slot?["location"]?.ToString(),
                UpdatedAt: ParseDto(payload["updatedAt"] ?? payload["updated_at"])));
        }
        return roster
            .OrderBy(r => r.ExamSlotDate ?? string.Empty, StringComparer.Ordinal)
            .ThenBy(r => r.FullName ?? string.Empty, StringComparer.Ordinal)
            .ToList();
    }

    private static string? ResolveCommitteeName(
        JsonObject applicant,
        IReadOnlyDictionary<string, string> committeeNameByCode)
    {
        var explicitName =
            AdminRecordJson.StringProp(applicant, "assignedCommitteeName") ??
            AdminRecordJson.StringProp(applicant, "committeeName") ??
            AdminRecordJson.StringProp(applicant, "committeeLabelAr");
        if (!string.IsNullOrWhiteSpace(explicitName)) return explicitName;

        var code =
            AdminRecordJson.StringProp(applicant, "assignedCommitteeId") ??
            AdminRecordJson.StringProp(applicant, "committeeId") ??
            AdminRecordJson.StringProp(applicant, "committeeCode") ??
            AdminRecordJson.StringProp(applicant, "definitionCode");
        return !string.IsNullOrWhiteSpace(code) && committeeNameByCode.TryGetValue(code, out var mappedName)
            ? mappedName
            : null;
    }

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
        var booked = await LoadBookedApplicantsByNidAsync(ct);
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
    private async Task<IReadOnlyDictionary<string, JsonObject>> LoadBookedApplicantsByNidAsync(CancellationToken ct)
    {
        IReadOnlyList<JsonObject> payloads;
        try { payloads = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return new Dictionary<string, JsonObject>(); }
        var map = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
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
            var byNid = await LoadBookedApplicantsByNidAsync(ct);
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
        var dbRows = await LoadAsync(spec, ct);
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
        var rows = await LoadAsync(spec, ct);
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
    private async Task<IReadOnlyList<LoadedRow>> LoadAsync(DomainSpec spec, CancellationToken ct) => spec.Domain switch
    {
        // Domain-specific loaders for sheets whose data lives nested in another
        // bucket — registry's `module=relatives|acquaintance|examResults` rows
        // are empty in production because the data physically lives elsewhere:
        //   - Relatives  → nested in applicant.family.{father,mother,siblings,…}
        //   - ExamResults → nested in applicant.followUp[TST-NN]
        //   - AcquaintanceDocs → dedicated `applicant_acquaintance_docs` table
        ExchangeDomain.Relatives => await LoadApplicantRelativesAsync(ct),
        ExchangeDomain.ExamResults => await LoadApplicantExamResultsAsync(ct),
        ExchangeDomain.AcquaintanceDocs => await LoadAcquaintanceDocsAsync(ct),
        _ => spec.Storage switch
        {
            ExchangeStorage.DocStore => await LoadDocStoreAsync(spec, ct),
            ExchangeStorage.Lookups => await LoadLookupsAsync(ct),
            ExchangeStorage.AdmissionRules => await LoadAdmissionRulesAsync(ct),
            ExchangeStorage.Exams => await LoadExamsAsync(ct),
            ExchangeStorage.ExamSlots => await LoadExamSlotsAsync(ct),
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

    private async Task<IReadOnlyList<LoadedRow>> LoadDocStoreAsync(DomainSpec spec, CancellationToken ct)
    {
        // Read through OperationalRecordsService so applicants resolve to the core
        // dbo.applicants projection and other modules to their operational tables.
        // If a module isn't registered in the (evolving) store, export it as empty
        // rather than throwing.
        IReadOnlyList<JsonObject> payloads;
        try { payloads = await records.ListAsync(spec.DocModule!, ct); }
        catch (InvalidOperationException) { return []; }
        var result = new List<LoadedRow>(payloads.Count);
        foreach (var payload in payloads)
        {
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            // Applicants are only exported once the first exam appointment is booked.
            // Draft / incomplete / awaiting-booking rows are intentionally withheld so
            // external consumers receive officially scheduled applicants only.
            if (spec.Domain == ExchangeDomain.Applicants && !IsApplicantBooked(payload)) continue;
            // For the Applicants sheet, prune branches that have their own dedicated
            // sheets so we don't ship `family.father.…` columns next to the dedicated
            // Relatives sheet. Also drop the original `profile.*` shape — the
            // projection already lifts those fields to canonical top-level columns.
            var flattenSource = spec.Domain == ExchangeDomain.Applicants
                ? PruneBranches(payload, ApplicantSheetExcludedBranches)
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

    private async Task<IReadOnlyList<LoadedRow>> LoadAdmissionRulesAsync(CancellationToken ct)
    {
        var rows = await db.AdmissionRules.AsNoTracking().ToListAsync(ct);
        return rows.Select(x =>
        {
            var bk = $"{x.CycleId}|{x.Version}";
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["cycle_id"] = x.CycleId, ["version"] = x.Version.ToString(CultureInfo.InvariantCulture),
            };
            foreach (var (k, v) in JsonFlatten.Flatten(ParseObject(x.PayloadJson)))
                if (k is not ("cycleId" or "version") && !NonDataColumns.Contains(k)) data[k] = v;
            return Loaded(x.Id, bk, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamsAsync(CancellationToken ct)
    {
        var rows = await db.Exams.AsNoTracking().ToListAsync(ct);
        return rows.Select(x => Loaded(x.Id, x.Id, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["name_ar"] = x.NameAr, ["cycle_id"] = x.CycleId, ["cycle_name"] = x.CycleName, ["scheduled_for"] = x.ScheduledFor,
            ["access_start_at"] = x.AccessStartAt, ["access_end_at"] = x.AccessEndAt,
            ["duration_minutes"] = x.DurationMinutes?.ToString(CultureInfo.InvariantCulture),
            ["question_count"] = x.QuestionCount?.ToString(CultureInfo.InvariantCulture),
            ["random_selection"] = x.RandomSelection?.ToString().ToLowerInvariant(),
            ["random_question_order"] = x.RandomQuestionOrder?.ToString().ToLowerInvariant(),
            ["display_mode"] = x.DisplayMode, ["status"] = x.Status,
        }, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem)).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamSlotsAsync(CancellationToken ct)
    {
        var rows = await db.ExamSlots.AsNoTracking().ToListAsync(ct);
        return rows.Select(x => Loaded(x.Id, x.Id, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["date"] = x.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ["time"] = x.Time,
            ["location"] = x.Location, ["capacity"] = x.Capacity.ToString(CultureInfo.InvariantCulture),
            ["reserved"] = x.Reserved.ToString(CultureInfo.InvariantCulture),
        }, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem)).ToList();
    }

    /// <summary>Explodes each booked applicant's `family` payload into per-member
    /// rows so the Relatives sheet links back to the applicant via
    /// `applicantNationalId`. Covers father, mother, paternal/maternal
    /// grandparents, fatherWives[], motherHusbands[], siblings[],
    /// extended relatives[] (uncles/aunts), and guardian.</summary>
    private async Task<IReadOnlyList<LoadedRow>> LoadApplicantRelativesAsync(CancellationToken ct)
    {
        IReadOnlyList<JsonObject> applicants;
        try { applicants = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return []; }

        var result = new List<LoadedRow>();
        foreach (var applicant in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(applicant)) continue;
            if (!IsApplicantBooked(applicant)) continue;
            var nid = applicant["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            var family = applicant["family"] as JsonObject;
            if (family is null) continue;

            var updated = ParseDto(applicant["updatedAt"] ?? applicant["updated_at"]) ?? default;
            var created = ParseDto(applicant["createdAt"] ?? applicant["created_at"]) ?? updated;

            void Emit(string seq, string kinshipKey, JsonObject? member)
            {
                if (member is null) return;
                var data = ProjectFamilyMember(member, kinshipKey);
                if (data.Count == 0) return;
                data["applicantNationalId"] = nid;
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
    private async Task<IReadOnlyList<LoadedRow>> LoadApplicantExamResultsAsync(CancellationToken ct)
    {
        IReadOnlyList<JsonObject> applicants;
        try { applicants = await records.ListAsync("applicants", ct); }
        catch (InvalidOperationException) { return []; }

        var result = new List<LoadedRow>();
        foreach (var applicant in applicants)
        {
            if (AdminRecordJson.IsSoftDeleted(applicant)) continue;
            if (!IsApplicantBooked(applicant)) continue;
            var nid = applicant["nationalId"]?.ToString();
            if (string.IsNullOrWhiteSpace(nid)) continue;
            var followUp = applicant["followUp"] as JsonObject;
            if (followUp is null || followUp.Count == 0) continue;

            var updated = ParseDto(applicant["updatedAt"] ?? applicant["updated_at"]) ?? default;
            var created = ParseDto(applicant["createdAt"] ?? applicant["created_at"]) ?? updated;
            foreach (var (examCode, node) in followUp)
            {
                var outcome = node?.ToString();
                if (string.IsNullOrWhiteSpace(examCode) || string.IsNullOrWhiteSpace(outcome)) continue;
                var bk = $"{nid}|{examCode}";
                var data = new Dictionary<string, string?>(StringComparer.Ordinal)
                {
                    ["applicantNationalId"] = nid,
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
    private async Task<IReadOnlyList<LoadedRow>> LoadAcquaintanceDocsAsync(CancellationToken ct)
    {
        if (!db.Database.IsRelational()) return [];
        var docs = await db.ApplicantAcquaintanceDocs.AsNoTracking().ToListAsync(ct);
        if (docs.Count == 0) return [];

        // Resolve applicantId(GUID) → nationalId via the booked-applicants map.
        var booked = await LoadBookedApplicantsByNidAsync(ct);
        var nidById = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (nid, payload) in booked)
        {
            var tableId = payload["applicantTableId"]?.ToString();
            if (!string.IsNullOrWhiteSpace(tableId)) nidById[tableId] = nid;
            var id = payload["id"]?.ToString();
            if (!string.IsNullOrWhiteSpace(id)) nidById[id] = nid;
        }

        var result = new List<LoadedRow>(docs.Count);
        foreach (var doc in docs)
        {
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
}

public enum ExportFilterKind { All, ChangedAfter, ModifiedSinceCreation, SinceLastExport }

public sealed record ExportFilter(
    ExportFilterKind Kind,
    DateTimeOffset? ChangedAfter,
    DateTimeOffset? LastExportAt,
    IReadOnlySet<string>? NationalIds = null)
{
    public static readonly ExportFilter Default = new(ExportFilterKind.All, null, null, null);
}
