using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// Centralized export / change-detection / import engine for the 9 exchangeable
/// domains. See <see cref="DataExchangeRegistry"/> for the locked sheet-name
/// contract. Every export and apply writes one append-only audit row
/// (DB_CONSTRAINTS §9). The checksum used for classification is computed over a
/// row's DATA columns only via <see cref="RowChecksum"/> — recomputed on BOTH
/// sides so offline cell edits (which don't touch the checksum cell) are still
/// detected as Changed.
/// </summary>
public sealed class DataExchangeService(
    AdminDbContext db,
    IAuditSink auditSink,
    IChangeTrackingActorProvider actor)
{
    private const string Module = "data-exchange";
    private const string ImportSource = "data-exchange-import";
    private const string AuditEntityType = "data-exchange";

    private static readonly string[] TrackingColumns =
        ["created_at", "updated_at", "row_version", "last_modified_by", "source_system", "checksum"];

    // Relaxed encoder so exported payload_json carries readable Arabic (not \uXXXX)
    // in the Excel cell. Checksums stay consistent — RowChecksum canonicalizes both
    // sides independently of this encoder.
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
            var rows = await LoadAsync(spec, ct);
            var filtered = ApplyFilter(rows, filter);
            var columns = ColumnsFor(spec);
            var rowDicts = filtered.Select(r => ToFullDict(spec, r)).ToList();
            total += rowDicts.Count;
            sheets.Add(new ExportSheetDto(
                spec.Domain.ToString(), spec.SheetName, spec.TitleAr, columns, rowDicts));
        }

        var watermark = DateTimeOffset.UtcNow;
        await EmitAuditAsync("export", $"تصدير {sheets.Count} ورقة · {total} صف",
            total, inserted: 0, updated: 0, skipped: 0, failed: 0, ct);

        return new ExportResultDto(layout, watermark.ToString("O", CultureInfo.InvariantCulture), total, sheets);
    }

    private static IReadOnlyList<LoadedRow> ApplyFilter(IReadOnlyList<LoadedRow> rows, ExportFilter filter)
        => filter.Kind switch
        {
            ExportFilterKind.All => rows,
            ExportFilterKind.ChangedAfter => rows.Where(r => filter.ChangedAfter is { } d && r.UpdatedAt >= d).ToList(),
            ExportFilterKind.ModifiedSinceCreation => rows.Where(r => r.UpdatedAt != r.CreatedAt).ToList(),
            ExportFilterKind.SinceLastExport => filter.LastExportAt is { } w
                ? rows.Where(r => r.UpdatedAt >= w).ToList()
                : rows,
            _ => rows,
        };

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
            outcomes.AddRange(await ClassifySheetAsync(spec, sheet, ct));
        }

        var counts = Enum.GetValues<ImportRowClass>()
            .ToDictionary(Camel, c => outcomes.Count(o => o.Class == Camel(c)));
        return new ImportPreviewResult(counts, outcomes, sheetIssues);
    }

    private async Task<List<ImportRowOutcome>> ClassifySheetAsync(
        DomainSpec spec, ImportSheetInput sheet, CancellationToken ct)
    {
        var dbRows = await LoadAsync(spec, ct);
        var dbByKey = dbRows.GroupBy(r => r.BusinessKey, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);
        var dataColumns = DataColumnsFor(spec);
        var checksumColumns = new[] { "business_key" }.Concat(dataColumns).ToArray();

        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var outcomes = new List<ImportRowOutcome>(sheet.Rows.Count);

        for (var i = 0; i < sheet.Rows.Count; i++)
        {
            var row = sheet.Rows[i];
            var (bk, validationErrors) = ResolveBusinessKey(spec, row);

            if (validationErrors.Count > 0)
            {
                outcomes.Add(new ImportRowOutcome(spec.Domain.ToString(), spec.SheetName, i, bk,
                    Camel(ImportRowClass.Invalid), validationErrors));
                continue;
            }
            if (!seenKeys.Add(bk))
            {
                outcomes.Add(new ImportRowOutcome(spec.Domain.ToString(), spec.SheetName, i, bk,
                    Camel(ImportRowClass.Invalid), ["مفتاح مكرر داخل الملف"]));
                continue;
            }

            if (!dbByKey.TryGetValue(bk, out var matches) || matches.Count == 0)
            {
                outcomes.Add(Outcome(spec, i, bk, ImportRowClass.New));
                continue;
            }
            if (matches.Count > 1)
            {
                outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Conflict, "المفتاح يطابق أكثر من صف"));
                continue;
            }

            var dbRow = matches[0];
            var dbChecksum = ChecksumOf(dbRow, checksumColumns);
            var importChecksum = RowChecksum.Compute(
                checksumColumns.Select(c => new KeyValuePair<string, object?>(c, ValueFor(c, bk, row))));

            if (string.Equals(dbChecksum, importChecksum, StringComparison.Ordinal))
            {
                outcomes.Add(Outcome(spec, i, bk, ImportRowClass.Skipped));
                continue;
            }

            outcomes.Add(Outcome(spec, i, bk, IsDbNewer(dbRow, row) ? ImportRowClass.Outdated : ImportRowClass.Changed));
        }

        return outcomes;
    }

    private static object? ValueFor(string column, string businessKey, IReadOnlyDictionary<string, string?> row)
        => column == "business_key" ? businessKey : (row.TryGetValue(column, out var v) ? v : null);

    private static string ChecksumOf(LoadedRow row, IReadOnlyList<string> checksumColumns)
        => RowChecksum.Compute(checksumColumns.Select(c =>
            new KeyValuePair<string, object?>(c,
                c == "business_key" ? row.BusinessKey : (row.Data.TryGetValue(c, out var v) ? v : null))));

    private static bool IsDbNewer(LoadedRow dbRow, IReadOnlyDictionary<string, string?> importRow)
    {
        if (importRow.TryGetValue("row_version", out var rvRaw) && TryDecodeRowVersion(rvRaw, out var imported))
        {
            var cmp = CompareRowVersion(dbRow.RowVersion, imported);
            if (cmp != 0) return cmp > 0;
        }
        if (importRow.TryGetValue("updated_at", out var uaRaw)
            && DateTimeOffset.TryParse(uaRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var importedUpdated))
        {
            return dbRow.UpdatedAt > importedUpdated;
        }
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

        await using var tx = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            foreach (var sheet in request.Sheets)
            {
                if (!DataExchangeRegistry.BySheetName.TryGetValue(sheet.SheetName, out var spec))
                {
                    failed.Add(new ImportFailedRow(-1, sheet.SheetName, ["اسم ورقة غير معروف"]));
                    continue;
                }

                var outcomes = await ClassifySheetAsync(spec, sheet, ct);
                for (var i = 0; i < sheet.Rows.Count; i++)
                {
                    var outcome = outcomes[i];
                    var row = sheet.Rows[i];
                    attempted++;

                    switch (outcome.Class)
                    {
                        case "new":
                            await UpsertAsync(spec, outcome.BusinessKey, row, ct);
                            inserted++;
                            break;

                        case "changed" when applyChanged:
                            await UpsertAsync(spec, outcome.BusinessKey, row, ct);
                            updated++;
                            break;

                        case "outdated" when request.ForceUpdate:
                            await UpsertAsync(spec, outcome.BusinessKey, row, ct);
                            updated++;
                            break;

                        case "invalid":
                            failed.Add(new ImportFailedRow(i, sheet.SheetName, outcome.Errors));
                            break;

                        case "conflict" when !request.SkipConflicts:
                            failed.Add(new ImportFailedRow(i, sheet.SheetName, ["تعارض — لم يُطبَّق"]));
                            break;

                        default:
                            skipped++;
                            break;
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

        await EmitAuditAsync("import", $"استيراد · {inserted} إضافة · {updated} تحديث",
            attempted, inserted, updated, skipped, failed.Count, ct);

        return new ImportApplyResult(attempted, inserted + updated, inserted, updated, skipped, failed.Count, failed);
    }

    // ──────────────────────────────────────────────────────────────────────
    // HISTORY + TEMPLATES
    // ──────────────────────────────────────────────────────────────────────
    public async Task<IReadOnlyList<HistoryEntryDto>> HistoryAsync(CancellationToken ct)
    {
        var rows = await db.AuditRows.AsNoTracking()
            .Where(x => x.Module == Module)
            .OrderByDescending(x => x.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        return rows.Select(x =>
        {
            JsonObject? d = null;
            try { d = JsonNode.Parse(x.Details) as JsonObject; } catch (JsonException) { /* tolerate legacy */ }
            int Num(string k) => d?[k]?.GetValue<int>() ?? 0;
            return new HistoryEntryDto(
                x.Id, x.Action, x.ActorName,
                d?["message"]?.GetValue<string>() ?? x.Details,
                Num("total"), Num("inserted"), Num("updated"), Num("skipped"), Num("failed"),
                x.CreatedAt);
        }).ToList();
    }

    public TemplateDto Template(DomainSpec spec) => new(spec.Domain.ToString(), spec.SheetName, spec.TitleAr, ColumnsFor(spec));

    public DateTimeOffset? LastExportWatermark(CancellationToken ct)
        => db.AuditRows.AsNoTracking()
            .Where(x => x.Module == Module && x.Action == "export")
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => (DateTimeOffset?)x.CreatedAt)
            .FirstOrDefault();

    // ──────────────────────────────────────────────────────────────────────
    // COLUMN SCHEMA
    // ──────────────────────────────────────────────────────────────────────
    public static IReadOnlyList<string> ColumnsFor(DomainSpec spec)
        => new[] { "id", "business_key" }.Concat(DataColumnsFor(spec)).Concat(TrackingColumns).ToList();

    private static IReadOnlyList<string> DataColumnsFor(DomainSpec spec) => spec.Storage switch
    {
        ExchangeStorage.DocStore => spec.BusinessKeyFields.Concat(["payload_json"]).Distinct().ToList(),
        ExchangeStorage.Lookups => ["lookup_key", "code", "name", "is_active", "payload_json"],
        ExchangeStorage.AdmissionRules => ["cycle_id", "version", "payload_json"],
        ExchangeStorage.Exams =>
        [
            "name_ar", "cycle_id", "cycle_name", "scheduled_for", "access_start_at", "access_end_at",
            "duration_minutes", "question_count", "random_selection", "random_question_order",
            "display_mode", "status",
        ],
        ExchangeStorage.ExamSlots => ["date", "time", "location", "capacity", "reserved"],
        _ => [],
    };

    private static IReadOnlyDictionary<string, string?> ToFullDict(DomainSpec spec, LoadedRow r)
    {
        var dict = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["id"] = r.Id,
            ["business_key"] = r.BusinessKey,
        };
        foreach (var col in DataColumnsFor(spec))
            dict[col] = r.Data.TryGetValue(col, out var v) ? v : null;
        dict["created_at"] = r.CreatedAt.ToString("O", CultureInfo.InvariantCulture);
        dict["updated_at"] = r.UpdatedAt.ToString("O", CultureInfo.InvariantCulture);
        dict["row_version"] = r.RowVersion.Length == 0 ? "" : Convert.ToBase64String(r.RowVersion);
        dict["last_modified_by"] = r.LastModifiedBy;
        dict["source_system"] = r.SourceSystem;
        dict["checksum"] = ChecksumOf(r, new[] { "business_key" }.Concat(DataColumnsFor(spec)).ToArray());
        return dict;
    }

    // ──────────────────────────────────────────────────────────────────────
    // READ (per storage kind) → LoadedRow
    // ──────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<LoadedRow>> LoadAsync(DomainSpec spec, CancellationToken ct) => spec.Storage switch
    {
        ExchangeStorage.DocStore => await LoadDocStoreAsync(spec, ct),
        ExchangeStorage.Lookups => await LoadLookupsAsync(ct),
        ExchangeStorage.AdmissionRules => await LoadAdmissionRulesAsync(ct),
        ExchangeStorage.Exams => await LoadExamsAsync(ct),
        ExchangeStorage.ExamSlots => await LoadExamSlotsAsync(ct),
        _ => [],
    };

    private async Task<IReadOnlyList<LoadedRow>> LoadDocStoreAsync(DomainSpec spec, CancellationToken ct)
    {
        var rows = await db.AdminRecordDocuments.AsNoTracking()
            .Where(x => x.Module == spec.DocModule)
            .ToListAsync(ct);
        var result = new List<LoadedRow>(rows.Count);
        foreach (var x in rows)
        {
            var payload = ParseObject(x.PayloadJson);
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["payload_json"] = payload.ToJsonString(Json),
            };
            foreach (var f in spec.BusinessKeyFields)
                data[f] = payload[f]?.ToString();
            var bk = ResolveDocBusinessKey(spec, payload, x.Id);
            result.Add(Loaded(x.Id, bk, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem));
        }
        return result;
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadLookupsAsync(CancellationToken ct)
    {
        var rows = await db.LookupRows.AsNoTracking().ToListAsync(ct);
        return rows.Select(x =>
        {
            var bk = $"{x.LookupKey}|{x.Code}";
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["lookup_key"] = x.LookupKey,
                ["code"] = x.Code,
                ["name"] = x.Name,
                ["is_active"] = x.IsActive ? "true" : "false",
                ["payload_json"] = x.PayloadJson,
            };
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
                ["cycle_id"] = x.CycleId,
                ["version"] = x.Version.ToString(CultureInfo.InvariantCulture),
                ["payload_json"] = x.PayloadJson,
            };
            return Loaded(x.Id, bk, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamsAsync(CancellationToken ct)
    {
        var rows = await db.Exams.AsNoTracking().ToListAsync(ct);
        return rows.Select(x =>
        {
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["name_ar"] = x.NameAr,
                ["cycle_id"] = x.CycleId,
                ["cycle_name"] = x.CycleName,
                ["scheduled_for"] = x.ScheduledFor,
                ["access_start_at"] = x.AccessStartAt,
                ["access_end_at"] = x.AccessEndAt,
                ["duration_minutes"] = x.DurationMinutes?.ToString(CultureInfo.InvariantCulture),
                ["question_count"] = x.QuestionCount?.ToString(CultureInfo.InvariantCulture),
                ["random_selection"] = x.RandomSelection?.ToString().ToLowerInvariant(),
                ["random_question_order"] = x.RandomQuestionOrder?.ToString().ToLowerInvariant(),
                ["display_mode"] = x.DisplayMode,
                ["status"] = x.Status,
            };
            return Loaded(x.Id, x.Id, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    private async Task<IReadOnlyList<LoadedRow>> LoadExamSlotsAsync(CancellationToken ct)
    {
        var rows = await db.ExamSlots.AsNoTracking().ToListAsync(ct);
        return rows.Select(x =>
        {
            var data = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["date"] = x.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["time"] = x.Time,
                ["location"] = x.Location,
                ["capacity"] = x.Capacity.ToString(CultureInfo.InvariantCulture),
                ["reserved"] = x.Reserved.ToString(CultureInfo.InvariantCulture),
            };
            return Loaded(x.Id, x.Id, data, x.CreatedAt, x.UpdatedAt, x.RowVersion, x.LastModifiedBy, x.SourceSystem);
        }).ToList();
    }

    // ──────────────────────────────────────────────────────────────────────
    // WRITE (per storage kind) — sets source_system = import provenance
    // ──────────────────────────────────────────────────────────────────────
    private async Task UpsertAsync(DomainSpec spec, string businessKey, IReadOnlyDictionary<string, string?> row, CancellationToken ct)
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

    private async Task UpsertDocStoreAsync(DomainSpec spec, IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? Get(row, "business_key") ?? throw Invalid("id مفقود");
        var payload = ParseObject(Get(row, "payload_json") ?? "{}");
        payload["id"] = id;
        var existing = await db.AdminRecordDocuments
            .FirstOrDefaultAsync(x => x.Module == spec.DocModule && x.Id == id, ct);
        if (existing is null)
        {
            db.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
            {
                Module = spec.DocModule!, Id = id, PayloadJson = payload.ToJsonString(Json),
                SourceSystem = ImportSource,
            });
        }
        else
        {
            existing.PayloadJson = payload.ToJsonString(Json);
            existing.SourceSystem = ImportSource;
        }
    }

    private async Task UpsertLookupAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var key = Get(row, "lookup_key") ?? throw Invalid("lookup_key مفقود");
        var code = Get(row, "code") ?? throw Invalid("code مفقود");
        var existing = await db.LookupRows.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct);
        if (existing is null)
        {
            db.LookupRows.Add(new LookupRowEntity
            {
                LookupKey = key, Code = code, Name = Get(row, "name") ?? code,
                IsActive = ParseBool(Get(row, "is_active")) ?? true,
                PayloadJson = Get(row, "payload_json") ?? "{}",
                SourceSystem = ImportSource,
            });
        }
        else
        {
            existing.Name = Get(row, "name") ?? existing.Name;
            existing.IsActive = ParseBool(Get(row, "is_active")) ?? existing.IsActive;
            existing.PayloadJson = Get(row, "payload_json") ?? existing.PayloadJson;
            existing.SourceSystem = ImportSource;
        }
    }

    private async Task UpsertAdmissionRuleAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.AdmissionRules.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing is null)
        {
            db.AdmissionRules.Add(new AdmissionRuleEntity
            {
                Id = id, CycleId = Get(row, "cycle_id") ?? "", Version = ParseInt(Get(row, "version")) ?? 1,
                PayloadJson = Get(row, "payload_json") ?? "{}", SourceSystem = ImportSource,
            });
        }
        else
        {
            existing.CycleId = Get(row, "cycle_id") ?? existing.CycleId;
            existing.Version = ParseInt(Get(row, "version")) ?? existing.Version;
            existing.PayloadJson = Get(row, "payload_json") ?? existing.PayloadJson;
            existing.SourceSystem = ImportSource;
        }
    }

    private async Task UpsertExamAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.Exams.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing is null)
        {
            db.Exams.Add(new ExamEntity
            {
                Id = id, NameAr = Get(row, "name_ar") ?? id, CycleId = Get(row, "cycle_id") ?? "",
                CycleName = Get(row, "cycle_name"), ScheduledFor = Get(row, "scheduled_for"),
                AccessStartAt = Get(row, "access_start_at"), AccessEndAt = Get(row, "access_end_at"),
                DurationMinutes = ParseInt(Get(row, "duration_minutes")),
                QuestionCount = ParseInt(Get(row, "question_count")),
                RandomSelection = ParseBool(Get(row, "random_selection")),
                RandomQuestionOrder = ParseBool(Get(row, "random_question_order")),
                DisplayMode = Get(row, "display_mode"), Status = Get(row, "status") ?? "draft",
                SourceSystem = ImportSource,
            });
        }
        else
        {
            existing.NameAr = Get(row, "name_ar") ?? existing.NameAr;
            existing.CycleId = Get(row, "cycle_id") ?? existing.CycleId;
            existing.CycleName = Get(row, "cycle_name") ?? existing.CycleName;
            existing.ScheduledFor = Get(row, "scheduled_for") ?? existing.ScheduledFor;
            existing.AccessStartAt = Get(row, "access_start_at") ?? existing.AccessStartAt;
            existing.AccessEndAt = Get(row, "access_end_at") ?? existing.AccessEndAt;
            existing.DurationMinutes = ParseInt(Get(row, "duration_minutes")) ?? existing.DurationMinutes;
            existing.QuestionCount = ParseInt(Get(row, "question_count")) ?? existing.QuestionCount;
            existing.RandomSelection = ParseBool(Get(row, "random_selection")) ?? existing.RandomSelection;
            existing.RandomQuestionOrder = ParseBool(Get(row, "random_question_order")) ?? existing.RandomQuestionOrder;
            existing.DisplayMode = Get(row, "display_mode") ?? existing.DisplayMode;
            existing.Status = Get(row, "status") ?? existing.Status;
            existing.SourceSystem = ImportSource;
        }
    }

    private async Task UpsertExamSlotAsync(IReadOnlyDictionary<string, string?> row, CancellationToken ct)
    {
        var id = Get(row, "id") ?? throw Invalid("id مفقود");
        var existing = await db.ExamSlots.FirstOrDefaultAsync(x => x.Id == id, ct);
        var date = ParseDateOnly(Get(row, "date"));
        if (existing is null)
        {
            db.ExamSlots.Add(new ExamSlotEntity
            {
                Id = id, Date = date ?? default, Time = Get(row, "time") ?? "08:00",
                Location = Get(row, "location") ?? "", Capacity = ParseInt(Get(row, "capacity")) ?? 0,
                Reserved = ParseInt(Get(row, "reserved")) ?? 0, SourceSystem = ImportSource,
            });
        }
        else
        {
            if (date is { } d) existing.Date = d;
            existing.Time = Get(row, "time") ?? existing.Time;
            existing.Location = Get(row, "location") ?? existing.Location;
            existing.Capacity = ParseInt(Get(row, "capacity")) ?? existing.Capacity;
            existing.Reserved = ParseInt(Get(row, "reserved")) ?? existing.Reserved;
            existing.SourceSystem = ImportSource;
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Business key + validation
    // ──────────────────────────────────────────────────────────────────────
    private static (string Key, List<string> Errors) ResolveBusinessKey(DomainSpec spec, IReadOnlyDictionary<string, string?> row)
    {
        var errors = new List<string>();
        var explicitKey = Get(row, "business_key");

        string key = spec.Storage switch
        {
            ExchangeStorage.Lookups => Compose(Get(row, "lookup_key"), Get(row, "code")),
            ExchangeStorage.AdmissionRules => Compose(Get(row, "cycle_id"), Get(row, "version")),
            ExchangeStorage.DocStore when spec.BusinessKeyFields.Count > 0
                => string.Join("|", spec.BusinessKeyFields.Select(f => Get(row, f) ?? PayloadField(row, f) ?? "")),
            _ => Get(row, "id") ?? "",
        };
        if (string.IsNullOrWhiteSpace(key) || key == "|")
            key = explicitKey ?? Get(row, "id") ?? "";

        if (string.IsNullOrWhiteSpace(key))
            errors.Add("لا يمكن اشتقاق مفتاح الصف (id/business_key مفقود)");

        // Applicants → national-ID format check (14 digits)
        if (spec.Domain == ExchangeDomain.Applicants)
        {
            var nid = Get(row, "nationalId") ?? PayloadField(row, "nationalId");
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

    private static string? PayloadField(IReadOnlyDictionary<string, string?> row, string field)
    {
        var raw = Get(row, "payload_json");
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try { return (JsonNode.Parse(raw) as JsonObject)?[field]?.ToString(); }
        catch (JsonException) { return null; }
    }

    // ──────────────────────────────────────────────────────────────────────
    // helpers
    // ──────────────────────────────────────────────────────────────────────
    private static LoadedRow Loaded(string id, string bk, Dictionary<string, string?> data,
        DateTimeOffset created, DateTimeOffset updated, byte[] rowVersion, string? lastBy, string? source)
        => new(id, bk, data, created, updated, rowVersion ?? [], lastBy,
               string.IsNullOrEmpty(source) ? ChangeTrackingColumns.DefaultSourceSystem : source);

    private static string Compose(string? a, string? b) =>
        string.IsNullOrEmpty(a) && string.IsNullOrEmpty(b) ? "" : $"{a}|{b}";

    private static string? Get(IReadOnlyDictionary<string, string?> row, string key)
        => row.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v) ? v : null;

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
        try { value = Convert.FromBase64String(raw); return true; }
        catch (FormatException) { return false; }
    }

    /// <summary>Compare two SQL rowversion byte arrays (big-endian, monotonic).</summary>
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

    private async Task EmitAuditAsync(string action, string message,
        int total, int inserted, int updated, int skipped, int failed, CancellationToken ct)
    {
        var details = new JsonObject
        {
            ["message"] = message, ["total"] = total, ["inserted"] = inserted,
            ["updated"] = updated, ["skipped"] = skipped, ["failed"] = failed,
        };
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-DATAX-{Guid.NewGuid():N}", Module, action, AuditEntityType, Module,
            actor.CurrentActorId, actor.CurrentActorId, details.ToJsonString(Json), DateTimeOffset.UtcNow), ct);
    }

    private sealed record LoadedRow(
        string Id, string BusinessKey, Dictionary<string, string?> Data,
        DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, byte[] RowVersion,
        string? LastModifiedBy, string SourceSystem);
}

// ── Export filter (parsed from query string) ────────────────────────────
public enum ExportFilterKind { All, ChangedAfter, ModifiedSinceCreation, SinceLastExport }

public sealed record ExportFilter(ExportFilterKind Kind, DateTimeOffset? ChangedAfter, DateTimeOffset? LastExportAt)
{
    public static readonly ExportFilter Default = new(ExportFilterKind.All, null, null);
}
