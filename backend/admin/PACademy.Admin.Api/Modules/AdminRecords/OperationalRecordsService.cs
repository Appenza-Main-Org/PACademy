using System.Text.Json.Nodes;
using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Persistence;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.AdminRecords;

internal sealed record ApplicantIdentityProjection(
    string TableId,
    string? AdminRecordId,
    string? NationalId,
    string? PhoneNumber,
    string? FullName,
    string? Email,
    string? Gender,
    string? Religion,
    string? BirthDate,
    string? BirthGovernorate,
    string? BirthDistrict,
    string? CertificateType,
    string? Source,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed class OperationalRecordsService(
    IAdminRecordsDbContext db,
    IHttpContextAccessor httpContextAccessor,
    IAuditSink auditSink,
    OperationalRecordStore operationalRecords)
{
    private const int DefaultBulkBatchSize = 5000;
    private const string ApplicantsIdentityTableName = "[applicants]";

    private static readonly IReadOnlyDictionary<int, string> ApplicantStageLabels = new Dictionary<int, string>
    {
        [1] = "تسجيل أولي",
        [2] = "التحقق من البيانات",
        [3] = "استكمال البيانات الشخصية",
        [4] = "بيانات المؤهل",
        [5] = "المراجعة",
        [6] = "سداد الرسوم",
        [7] = "بيانات الأسرة",
        [8] = "حجز الاختبارات",
        [9] = "طباعة بطاقة التردد",
        [10] = "المتابعة",
        [11] = "وثائق التعارف"
    };

    public OperationalRecordsService(
        IAdminRecordsDbContext db,
        IHttpContextAccessor httpContextAccessor,
        IAuditSink auditSink)
        : this(
            db,
            httpContextAccessor,
            auditSink,
            new OperationalRecordStore((IOperationalRecordsDbContext)db))
    {
    }

    public async Task<IReadOnlyList<JsonObject>> ListAsync(string module, CancellationToken ct)
    {
        if (CanUseNormalizedTables(module))
        {
            var normalizedRows = await ListNormalizedAsync(module, ct);
            if (normalizedRows is not null) return normalizedRows;
        }

        return await ListDocumentAsync(module, ct);
    }

    public async Task<object> PageAsync(string module, IQueryCollection query, CancellationToken ct)
    {
        var page = int.TryParse(query["page"], out var p) && p > 0 ? p : 1;
        var pageSize = int.TryParse(query["pageSize"], out var ps) && ps > 0 ? ps : 20;
        var search = query["search"].ToString();
        var rows = await ListAsync(module, ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            rows = rows.Where(x => x.ToJsonString(AdminRecordJson.Options).Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (module == "applicants")
        {
            rows = ApplyApplicantFilters(rows, query);
        }
        var total = rows.Count;
        var data = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return new { data, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) };
    }

    public async Task<JsonObject?> GetAsync(string module, string id, CancellationToken ct)
    {
        if (CanUseNormalizedTables(module))
        {
            var normalizedRow = await GetNormalizedAsync(module, id, ct);
            if (normalizedRow is not null) return normalizedRow;
        }

        return await GetDocumentAsync(module, id, ct);
    }

    public async Task<JsonObject> UpsertAsync(string module, string id, JsonObject payload, CancellationToken ct)
    {
        if (CanUseNormalizedTables(module))
        {
            var normalized = await UpsertNormalizedAsync(module, id, payload, ct);
            if (normalized is not null)
            {
                await EmitAuditAsync(module, "upsert", id, payload, DateTimeOffset.UtcNow, ct);
                return normalized;
            }
        }

        var now = DateTimeOffset.UtcNow;
        var isCreate = await operationalRecords.GetAsync(module, id, ct) is null;
        var next = await operationalRecords.UpsertAsync(module, id, payload, ct);
        await EmitAuditAsync(module, isCreate ? "create" : "update", id, payload, now, ct);
        return next;
    }

    public async Task<(HashSet<string> Nids, int NextSeat)> GradesImportIndexAsync(CancellationToken ct)
    {
        if (CanUseNormalizedTables("grades"))
        {
            var rows = await ExecuteNormalizedQueryAsync(
                $"""
                SELECT [nid], [seat]
                FROM {AdminDbContext.QualifiedTableName("applicant_grades")}
                """,
                null,
                reader => new JsonObject
                {
                    ["nid"] = reader.GetString(0),
                    ["seat"] = reader.GetInt32(1)
                },
                ct);
            var normalizedNids = rows
                .Select(x => AdminRecordJson.StringProp(x, "nid"))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!)
                .ToHashSet(StringComparer.Ordinal);
            var normalizedMaxSeat = rows
                .Select(x => (int)(AdminRecordJson.NumberProp(x, "seat") ?? 0))
                .DefaultIfEmpty(0)
                .Max();
            return (normalizedNids, normalizedMaxSeat + 1);
        }

        var nids = new HashSet<string>(StringComparer.Ordinal);
        var maxSeat = 0;

        foreach (var payload in await operationalRecords.ListAsync("grades", ct))
        {
            // `seat` still counts soft-deleted rows so we never reissue a tombstoned seat id.
            maxSeat = Math.Max(maxSeat, (int)(AdminRecordJson.NumberProp(payload, "seat") ?? 0));
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            var nid = AdminRecordJson.StringProp(payload, "nid");
            if (!string.IsNullOrWhiteSpace(nid)) nids.Add(nid);
        }

        return (nids, maxSeat + 1);
    }

    public async Task<int> InsertManyAsync(
        string module,
        IReadOnlyList<JsonObject> payloads,
        CancellationToken ct,
        int batchSize = DefaultBulkBatchSize)
    {
        if (payloads.Count == 0) return 0;
        if (CanUseNormalizedTables(module))
        {
            if (module == "grades")
            {
                return await InsertManyNormalizedGradesAsync(payloads, ct, batchSize);
            }

            var inserted = 0;
            foreach (var payload in payloads)
            {
                var id = AdminRecordJson.StringProp(payload, "id")
                    ?? throw new InvalidOperationException("Bulk admin record payload is missing id.");
                await UpsertNormalizedAsync(module, id, payload, ct);
                inserted++;
            }
            return inserted;
        }

        return await operationalRecords.InsertManyAsync(module, payloads, ct, batchSize);
    }

    private async Task<int> InsertManyNormalizedGradesAsync(
        IReadOnlyList<JsonObject> payloads,
        CancellationToken ct,
        int batchSize)
    {
        var written = 0;
        for (var offset = 0; offset < payloads.Count; offset += batchSize)
        {
            var batch = payloads
                .Skip(offset)
                .Take(batchSize)
                .Select(payload =>
                {
                    if (AdminRecordJson.StringProp(payload, "nid") is not { Length: 14 })
                    {
                        throw new ConflictException("INVALID_GRADE_NID", "لا يمكن حفظ درجة بدون رقم قومي صحيح");
                    }
                    return payload.DeepClone();
                })
                .ToArray();
            var batchJson = new JsonArray(batch).ToJsonString(AdminRecordJson.Options);
            var now = DateTimeOffset.UtcNow;
            await ExecuteNormalizedNonQueryAsync($"""
                WITH source_rows AS
                (
                    SELECT
                        COALESCE(JSON_VALUE([value], '$.id'), JSON_VALUE([value], '$.seat')) AS [admin_record_id],
                        TRY_CONVERT(int, JSON_VALUE([value], '$.seat')) AS [seat],
                        JSON_VALUE([value], '$.seatingNumber') AS [seating_number],
                        JSON_VALUE([value], '$.nid') AS [nid],
                        COALESCE(NULLIF(JSON_VALUE([value], '$.name'), N''), JSON_VALUE([value], '$.nameAr')) AS [name],
                        COALESCE(NULLIF(JSON_VALUE([value], '$.kind'), N''), N'general') AS [kind],
                        JSON_VALUE([value], '$.gender') AS [gender],
                        JSON_VALUE([value], '$.branch') AS [branch],
                        TRY_CONVERT(int, JSON_VALUE([value], '$.graduationYear')) AS [graduation_year],
                        COALESCE(NULLIF(JSON_VALUE([value], '$.schoolCategoryCode'), N''), NULLIF(JSON_VALUE([value], '$.schoolCategory'), N'')) AS [school_category_code],
                        JSON_VALUE([value], '$.school') AS [school],
                        JSON_VALUE([value], '$.region') AS [region],
                        JSON_VALUE([value], '$.examRound') AS [exam_round],
                        TRY_CONVERT(decimal(7,2), JSON_VALUE([value], '$.total')) AS [total],
                        TRY_CONVERT(decimal(7,2), JSON_VALUE([value], '$.importMax')) AS [import_max],
                        TRY_CONVERT(decimal(7,2), JSON_VALUE([value], '$.overrideMax')) AS [override_max],
                        JSON_VALUE([value], '$.lastEditedAt') AS [last_edited_at],
                        JSON_VALUE([value], '$.lastEditedBy') AS [last_edited_by],
                        TRY_CONVERT(datetimeoffset, JSON_VALUE([value], '$.gradeChangedAt')) AS [grade_changed_at],
                        TRY_CONVERT(decimal(7,2), JSON_VALUE([value], '$.previousGrade')) AS [previous_grade],
                        COALESCE(NULLIF(JSON_VALUE([value], '$.status'), N''), N'مستجد') AS [status],
                        CONVERT(nvarchar(max), [value]) AS [payload_json]
                    FROM OPENJSON(@payloads)
                )
                MERGE {AdminDbContext.QualifiedTableName("applicant_grades")} WITH (HOLDLOCK) AS target
                USING source_rows AS source
                ON target.[nid] COLLATE DATABASE_DEFAULT = source.[nid] COLLATE DATABASE_DEFAULT
                WHEN MATCHED THEN UPDATE SET
                    [admin_record_id] = source.[admin_record_id],
                    [seat] = source.[seat],
                    [seating_number] = source.[seating_number],
                    [name] = source.[name],
                    [kind] = source.[kind],
                    [gender] = source.[gender],
                    [branch] = source.[branch],
                    [graduation_year] = source.[graduation_year],
                    [school_category_code] = source.[school_category_code],
                    [school] = source.[school],
                    [region] = source.[region],
                    [exam_round] = source.[exam_round],
                    [total] = source.[total],
                    [import_max] = source.[import_max],
                    [override_max] = source.[override_max],
                    [last_edited_at] = source.[last_edited_at],
                    [last_edited_by] = source.[last_edited_by],
                    [grade_changed_at] = source.[grade_changed_at],
                    [previous_grade] = source.[previous_grade],
                    [status] = source.[status],
                    [payload_json] = source.[payload_json],
                    [updated_at] = @now
                WHEN NOT MATCHED THEN INSERT
                    ([id], [admin_record_id], [seat], [seating_number], [nid], [name], [kind], [gender], [branch], [graduation_year], [school_category_code], [school], [region], [exam_round], [total], [import_max], [override_max], [last_edited_at], [last_edited_by], [grade_changed_at], [previous_grade], [status], [payload_json], [created_at], [updated_at])
                VALUES
                    (NEWID(), source.[admin_record_id], source.[seat], source.[seating_number], source.[nid], source.[name], source.[kind], source.[gender], source.[branch], source.[graduation_year],
                     source.[school_category_code], source.[school], source.[region], source.[exam_round], source.[total], source.[import_max], source.[override_max], source.[last_edited_at],
                     source.[last_edited_by], source.[grade_changed_at], source.[previous_grade], source.[status], source.[payload_json], @now, @now);
                """, command =>
            {
                AddParameter(command, "@payloads", batchJson);
                AddParameter(command, "@now", now);
            }, ct);
            written += batch.Length;
        }

        return written;
    }

    public async Task AddBulkAuditRecordAsync(
        string module,
        string action,
        string entityId,
        string details,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        await EmitAuditAsync(module, action, entityId, details, now, ct);
    }

    public async Task<bool> DeleteAsync(string module, string id, CancellationToken ct)
    {
        if (CanUseNormalizedTables(module))
        {
            var deleted = await DeleteNormalizedAsync(module, id, ct);
            if (deleted)
            {
                await EmitAuditAsync(module, "delete", id, new JsonObject { ["id"] = id }, DateTimeOffset.UtcNow, ct);
                return true;
            }
        }

        var payload = await operationalRecords.GetAsync(module, id, ct);
        if (payload is null) return false;
        var now = DateTimeOffset.UtcNow;
        await operationalRecords.DeleteAsync(module, id, ct);
        await EmitAuditAsync(module, "delete", id, payload, now, ct);
        return true;
    }

    public async Task<JsonObject?> ResetApplicantAsync(string id, CancellationToken ct)
    {
        var current = await GetAsync("applicants", id, ct);
        if (current is null) return null;

        var nationalId = AdminRecordJson.StringProp(current, "nationalId")
            ?? AdminRecordJson.StringProp(current, "national_id")
            ?? AdminRecordJson.StringProp(current, "nid")
            ?? throw new ConflictException("INVALID_APPLICANT_NID", "لا يمكن إعادة تعيين طلب بدون رقم قومي");

        if (!await ApplicantHasGradeAsync(nationalId, ct))
        {
            throw new ConflictException(
                "APPLICANT_GRADE_REQUIRED",
                "لا يمكن إعادة تعيين الطلب قبل وجود درجة للمتقدم في دورة القبول النشطة");
        }

        var next = current.DeepClone().AsObject();
        ClearApplicantEnteredData(next);
        next["stage"] = 3;
        next["furthestStage"] = 3;
        next["furthest_stage"] = 3;
        next["stageLabel"] = "استكمال البيانات الشخصية";
        next["paymentStatus"] = "pending";
        next["hasDocuments"] = false;
        next["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");

        var saved = await UpsertAsync("applicants", id, next, ct);
        await EmitAuditAsync(
            "applicants",
            "applicant.reset",
            nationalId,
            $"admin.applicants.reset · targetNid={nationalId}",
            DateTimeOffset.UtcNow,
            ct);
        return saved;
    }

    public async Task<bool> DeleteApplicantAsync(string id, CancellationToken ct)
    {
        var current = await GetAsync("applicants", id, ct);
        if (current is null) return false;
        var nationalId = AdminRecordJson.StringProp(current, "nationalId")
            ?? AdminRecordJson.StringProp(current, "national_id")
            ?? AdminRecordJson.StringProp(current, "nid")
            ?? id;

        var deleted = await DeleteAsync("applicants", id, ct);
        if (deleted)
        {
            await EmitAuditAsync(
                "applicants",
                "applicant.delete",
                nationalId,
                $"admin.applicants.delete · targetNid={nationalId}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    public async Task<JsonObject?> SetApplicantSuspensionAsync(
        string id,
        bool suspended,
        string? reason,
        CancellationToken ct)
    {
        var current = await GetAsync("applicants", id, ct);
        if (current is null) return null;

        if (suspended && string.IsNullOrWhiteSpace(reason))
        {
            throw new ConflictException("SUSPENSION_REASON_REQUIRED", "سبب الإيقاف مطلوب");
        }

        var nationalId = AdminRecordJson.StringProp(current, "nationalId")
            ?? AdminRecordJson.StringProp(current, "national_id")
            ?? AdminRecordJson.StringProp(current, "nid")
            ?? id;
        var next = current.DeepClone().AsObject();
        next["suspended"] = suspended;
        next["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        if (suspended)
        {
            var trimmedReason = reason?.Trim() ?? "";
            next["suspensionReason"] = trimmedReason;
            next["suspension_reason"] = trimmedReason;
        }
        else
        {
            next.Remove("suspensionReason");
            next.Remove("suspension_reason");
        }

        var saved = await UpsertAsync("applicants", id, next, ct);
        await EmitAuditAsync(
            "applicants",
            suspended ? "applicant.suspend" : "applicant.unsuspend",
            nationalId,
            $"admin.applicants.{(suspended ? "suspend" : "unsuspend")} · targetNid={nationalId}",
            DateTimeOffset.UtcNow,
            ct);
        return saved;
    }

    public async Task<int> DeleteModuleAsync(string module, CancellationToken ct)
    {
        var deleted = await operationalRecords.DeleteModuleAsync(module, ct);
        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_delete",
                module,
                $"{module}.bulk_delete · deleted={deleted}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    public async Task<int> DeleteModuleTrackedAsync(string module, CancellationToken ct)
    {
        var deleted = await operationalRecords.DeleteModuleAsync(module, ct);

        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_delete",
                module,
                $"{module}.bulk_delete · deleted={deleted}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    public async Task<int> DeleteManyAsync(string module, IReadOnlyCollection<string> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return 0;
        var deleted = await operationalRecords.DeleteManyAsync(module, ids, ct);
        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_delete",
                $"{module}:{deleted}",
                $"{module}.bulk_delete · deleted={deleted}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    public async Task<int> DeleteManyTrackedAsync(string module, IReadOnlyCollection<string> ids, CancellationToken ct)
    {
        var deleted = await operationalRecords.DeleteManyAsync(module, ids, ct);

        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_delete",
                $"{module}:{deleted}",
                $"{module}.bulk_delete · deleted={deleted}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    /// <summary>
    /// Stamps `deletedAt` / `deletedBy` / `deleteReason` on the payload JSON for the
    /// given module + ids. Already-soft-deleted rows are skipped. No-op if none found.
    /// </summary>
    public async Task<int> SoftDeleteManyAsync(
        string module,
        IReadOnlyCollection<string> ids,
        string? deletedBy,
        string? reason,
        CancellationToken ct)
    {
        if (ids.Count == 0) return 0;
        if (module == "grades" && CanUseNormalizedTables(module))
        {
            var normalizedDeleted = 0;
            foreach (var id in ids)
            {
                normalizedDeleted += await ExecuteNormalizedNonQueryWithCountAsync($"""
                    UPDATE {AdminDbContext.QualifiedTableName("applicant_grades")}
                    SET [payload_json] = JSON_MODIFY(
                            JSON_MODIFY(
                                JSON_MODIFY(COALESCE([payload_json], @emptyJson), '$.deletedAt', @deletedAt),
                                '$.deletedBy',
                                @deletedBy
                            ),
                            '$.deleteReason',
                            @reason
                        ),
                        [updated_at] = @now
                    WHERE (CONVERT(nvarchar(128), [seat]) = @id OR [admin_record_id] = @id OR [nid] = @id)
                      AND JSON_VALUE(COALESCE([payload_json], @emptyJson), '$.deletedAt') IS NULL
                    """, command =>
                {
                    var normalizedNow = DateTimeOffset.UtcNow;
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@deletedAt", normalizedNow.ToString("O"));
                    AddParameter(command, "@deletedBy", deletedBy ?? "system");
                    AddParameter(command, "@reason", reason ?? "");
                    AddParameter(command, "@now", normalizedNow);
                    AddParameter(command, "@emptyJson", "{}");
                }, ct);
            }
            if (normalizedDeleted > 0)
            {
                await EmitAuditAsync(module, "bulk_soft_delete", $"{module}:{normalizedDeleted}", $"{module}.bulk_soft_delete · deleted={normalizedDeleted}", DateTimeOffset.UtcNow, ct);
            }
            return normalizedDeleted;
        }

        var deleted = await operationalRecords.SoftDeleteManyAsync(module, ids, deletedBy, reason, ct);

        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_soft_delete",
                $"{module}:{deleted}",
                $"{module}.bulk_soft_delete · deleted={deleted}",
                DateTimeOffset.UtcNow,
                ct);
        }
        return deleted;
    }

    /// <summary>
    /// Bulk soft-delete for an entire module — stamps `deletedAt` on every live row.
    /// Already-soft-deleted rows are skipped. Used by `clearAll` operations that
    /// want an audit trail rather than a hard wipe.
    /// </summary>
    public async Task<int> SoftDeleteModuleAsync(
        string module,
        string? deletedBy,
        string? reason,
        CancellationToken ct)
    {
        if (module == "grades" && CanUseNormalizedTables(module))
        {
            var normalizedNow = DateTimeOffset.UtcNow;
            var normalizedDeleted = await ExecuteNormalizedNonQueryWithCountAsync($"""
                UPDATE {AdminDbContext.QualifiedTableName("applicant_grades")}
                SET [payload_json] = JSON_MODIFY(
                        JSON_MODIFY(
                            JSON_MODIFY(COALESCE([payload_json], @emptyJson), '$.deletedAt', @deletedAt),
                            '$.deletedBy',
                            @deletedBy
                        ),
                        '$.deleteReason',
                        @reason
                    ),
                    [updated_at] = @now
                WHERE JSON_VALUE(COALESCE([payload_json], @emptyJson), '$.deletedAt') IS NULL
                """, command =>
            {
                AddParameter(command, "@deletedAt", normalizedNow.ToString("O"));
                AddParameter(command, "@deletedBy", deletedBy ?? "system");
                AddParameter(command, "@reason", reason ?? "");
                AddParameter(command, "@now", normalizedNow);
                AddParameter(command, "@emptyJson", "{}");
            }, ct);
            if (normalizedDeleted > 0)
            {
                await EmitAuditAsync(module, "bulk_soft_delete", module, $"{module}.bulk_soft_delete · deleted={normalizedDeleted}", normalizedNow, ct);
            }
            return normalizedDeleted;
        }

        var now = DateTimeOffset.UtcNow;
        var deleted = await operationalRecords.SoftDeleteModuleAsync(module, deletedBy, reason, ct);

        if (deleted > 0)
        {
            await EmitAuditAsync(
                module,
                "bulk_soft_delete",
                module,
                $"{module}.bulk_soft_delete · deleted={deleted}",
                now,
                ct);
        }
        return deleted;
    }

    public async Task<int> DeleteFromArrayModulesAsync(string modulePrefix, string arrayName, string id, CancellationToken ct)
    {
        return await operationalRecords.DeleteFromArrayModulesAsync(modulePrefix, arrayName, id, ct);
    }

    public async Task<JsonObject> SingletonAsync(string module, JsonObject fallback, CancellationToken ct)
    {
        var row = await GetAsync(module, module, ct);
        return row ?? fallback;
    }

    public async Task<object> DistributionAsync(string field, CancellationToken ct)
    {
        var rows = await ListAsync("applicants", ct);
        return rows
            .GroupBy(x => AdminRecordJson.StringProp(x, field) ?? "غير محدد")
            .Select(g => new { label = g.Key, value = g.Count() })
            .OrderByDescending(x => x.value)
            .ToList();
    }

    public async Task<object> StatsAsync(CancellationToken ct)
    {
        var kpis = await SingletonAsync("kpis", [], ct);
        return kpis;
    }

    private async Task<IReadOnlyList<JsonObject>> ListDocumentAsync(string module, CancellationToken ct)
    {
        return await operationalRecords.ListAsync(module, ct);
    }

    private async Task<JsonObject?> GetDocumentAsync(string module, string id, CancellationToken ct)
    {
        return await operationalRecords.GetAsync(module, id, ct);
    }

    private static IReadOnlyList<JsonObject> ApplyApplicantFilters(
        IReadOnlyList<JsonObject> rows,
        IQueryCollection query)
    {
        return rows
            .Where(row =>
                StringFilterMatches(FirstString(row, "status"), query["status"])
                && StringFilterMatches(FirstString(row, "governorate"), query["governorate"])
                && StringFilterMatches(FirstString(row, "certType", "certificateType"), query["certType"])
                && ApplicantGenderMatches(row, query["gender"])
                && StringFilterMatches(FirstString(row, "religion"), query["religion"])
                && StringFilterMatches(FirstString(row, "source"), query["source"])
                && StringFilterMatches(FirstString(row, "birthGovernorate"), query["birthGovernorate"]))
            .ToList();
    }

    private static bool StringFilterMatches(string? actual, string? requested)
    {
        if (IsAllFilter(requested)) return true;
        return string.Equals(actual?.Trim(), requested!.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static bool ApplicantGenderMatches(JsonObject row, string? requested)
    {
        if (IsAllFilter(requested)) return true;

        var actual = FirstString(row, "gender");
        if (string.IsNullOrWhiteSpace(actual)) return false;

        return requested!.Trim().ToLowerInvariant() switch
        {
            "male" => actual.Equals("male", StringComparison.OrdinalIgnoreCase) || actual == "ذكر",
            "female" => actual.Equals("female", StringComparison.OrdinalIgnoreCase) || actual == "أنثى",
            _ => string.Equals(actual.Trim(), requested.Trim(), StringComparison.OrdinalIgnoreCase)
        };
    }

    private static bool IsAllFilter(string? value) =>
        string.IsNullOrWhiteSpace(value) || value.Equals("all", StringComparison.OrdinalIgnoreCase);

    private static string? FirstString(JsonObject payload, params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = AdminRecordJson.StringProp(payload, key);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }

    private bool CanUseNormalizedTables(string module) =>
        db is DbContext context
        && context.Database.IsRelational()
        && NormalizedModuleKind(module) is not null;

    private static string? NormalizedModuleKind(string module)
    {
        return module switch
        {
            "applicants" => "applicants",
            "grades" => "grades",
            "cycles" => "cycles",
            "categories" => "categories",
            _ => null
        };
    }

    private async Task<IReadOnlyList<JsonObject>?> ListNormalizedAsync(string module, CancellationToken ct)
    {
        var kind = NormalizedModuleKind(module);
        return kind switch
        {
            "applicants" => await QueryApplicantRowsAsync(
                $"""
                SELECT [payload_json], [table_id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender],
                       [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source],
                       [created_at], [updated_at]
                FROM (
                    SELECT
                        [payload_json], [table_id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender],
                        [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source],
                        [created_at], [updated_at],
                        ROW_NUMBER() OVER (
                            PARTITION BY COALESCE([national_id], [table_id], [admin_record_id])
                            ORDER BY [updated_at] DESC, [row_priority] DESC
                        ) AS [rn]
                    FROM (
                        SELECT
                            0 AS [row_priority],
                            draft.[payload_json],
                            CONVERT(nvarchar(64), applicant.[id]) AS [table_id],
                            NULL AS [admin_record_id],
                            applicant.[national_id],
                            applicant.[phone_number],
                            applicant.[full_name],
                            applicant.[email],
                            applicant.[gender],
                            applicant.[religion],
                            applicant.[date_of_birth],
                            applicant.[birth_governorate],
                            applicant.[birth_district],
                            COALESCE(
                                JSON_VALUE(draft.[payload_json], '$.profile.certificateName'),
                                JSON_VALUE(draft.[payload_json], '$.profile.education.certificateName'),
                                JSON_VALUE(draft.[payload_json], '$.profile.qualificationLevel')
                            ) AS [certificate_type],
                            N'applicant-portal' AS [source],
                            applicant.[created_at],
                            draft.[updated_at]
                        FROM {ApplicantsIdentityTableName} applicant
                        INNER JOIN {AdminDbContext.QualifiedTableName("applicant_portal_records")} draft
                            ON draft.[type] = N'draft'
                           AND draft.[applicant_id] = CONVERT(nvarchar(64), applicant.[id])
                        WHERE COALESCE(TRY_CONVERT(int, JSON_VALUE(draft.[payload_json], '$.furthestStage')), 0) >= 1

                        UNION ALL

                        SELECT
                            1 AS [row_priority],
                            document.[payload_json],
                            COALESCE(CONVERT(nvarchar(64), applicant.[id]), document.[id]) AS [table_id],
                            document.[id] AS [admin_record_id],
                            COALESCE(applicant.[national_id], JSON_VALUE(document.[payload_json], '$.nationalId')) AS [national_id],
                            COALESCE(applicant.[phone_number], JSON_VALUE(document.[payload_json], '$.phoneNumber'), JSON_VALUE(document.[payload_json], '$.contact.mobilePhone')) AS [phone_number],
                            COALESCE(applicant.[full_name], JSON_VALUE(document.[payload_json], '$.name')) AS [full_name],
                            COALESCE(applicant.[email], JSON_VALUE(document.[payload_json], '$.email'), JSON_VALUE(document.[payload_json], '$.contact.email')) AS [email],
                            COALESCE(applicant.[gender], JSON_VALUE(document.[payload_json], '$.gender')) AS [gender],
                            COALESCE(applicant.[religion], JSON_VALUE(document.[payload_json], '$.religion')) AS [religion],
                            COALESCE(applicant.[date_of_birth], TRY_CONVERT(date, JSON_VALUE(document.[payload_json], '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(document.[payload_json], '$.dateOfBirth'))) AS [date_of_birth],
                            COALESCE(applicant.[birth_governorate], JSON_VALUE(document.[payload_json], '$.birthGovernorate'), JSON_VALUE(document.[payload_json], '$.currentAddress.governorate'), JSON_VALUE(document.[payload_json], '$.governorate')) AS [birth_governorate],
                            COALESCE(applicant.[birth_district], JSON_VALUE(document.[payload_json], '$.birthDistrict'), JSON_VALUE(document.[payload_json], '$.currentAddress.city'), JSON_VALUE(document.[payload_json], '$.city')) AS [birth_district],
                            COALESCE(JSON_VALUE(document.[payload_json], '$.certType'), JSON_VALUE(document.[payload_json], '$.education.certificateName')) AS [certificate_type],
                            COALESCE(applicant.[source], JSON_VALUE(document.[payload_json], '$.source'), N'api') AS [source],
                            COALESCE(applicant.[created_at], document.[created_at]) AS [created_at],
                            document.[updated_at]
                        FROM {AdminDbContext.QualifiedTableName("applicant_management_records")} document
                        LEFT JOIN {ApplicantsIdentityTableName} applicant
                            ON applicant.[national_id] = JSON_VALUE(document.[payload_json], '$.nationalId')
                            OR CONVERT(nvarchar(64), applicant.[id]) = document.[id]
                        WHERE document.[module] = N'applicants'
                    ) candidates
                ) rows
                WHERE [rn] = 1
                ORDER BY [national_id]
                """,
                ct),
            "grades" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], CONVERT(nvarchar(128), [seat]) AS [row_id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_grades")} ORDER BY [seat]",
                "row_id",
                ct),
            "cycles" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("admission_cycles")} ORDER BY [year] DESC",
                "id",
                ct),
            "categories" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [key] AS [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_categories")} ORDER BY [key]",
                "id",
                ct),
            "questions" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("exam_questions")} ORDER BY [id]",
                "id",
                ct),
            "exams" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("exams")} ORDER BY [id]",
                "id",
                ct),
            "settings" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("admin_settings")} WHERE [id] = N'settings'",
                "id",
                ct),
            "cycleApplicationSettings" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("cycle_application_settings")} WHERE [id] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", module)),
            _ => null
        };
    }

    private async Task<JsonObject?> GetNormalizedAsync(string module, string id, CancellationToken ct)
    {
        var kind = NormalizedModuleKind(module);
        var rows = kind switch
        {
            "applicants" => await QueryApplicantRowsAsync(
                $"""
                SELECT TOP (1) [payload_json], [table_id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender],
                       [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source],
                       [created_at], [updated_at]
                FROM (
                    SELECT
                        0 AS [row_priority],
                        draft.[payload_json],
                        CONVERT(nvarchar(64), applicant.[id]) AS [table_id],
                        NULL AS [admin_record_id],
                        applicant.[national_id],
                        applicant.[phone_number],
                        applicant.[full_name],
                        applicant.[email],
                        applicant.[gender],
                        applicant.[religion],
                        applicant.[date_of_birth],
                        applicant.[birth_governorate],
                        applicant.[birth_district],
                        COALESCE(
                            JSON_VALUE(draft.[payload_json], '$.profile.certificateName'),
                            JSON_VALUE(draft.[payload_json], '$.profile.education.certificateName'),
                            JSON_VALUE(draft.[payload_json], '$.profile.qualificationLevel')
                        ) AS [certificate_type],
                        N'applicant-portal' AS [source],
                        applicant.[created_at],
                        draft.[updated_at]
                    FROM {ApplicantsIdentityTableName} applicant
                    INNER JOIN {AdminDbContext.QualifiedTableName("applicant_portal_records")} draft
                        ON draft.[type] = N'draft'
                       AND draft.[applicant_id] = CONVERT(nvarchar(64), applicant.[id])
                    WHERE COALESCE(TRY_CONVERT(int, JSON_VALUE(draft.[payload_json], '$.furthestStage')), 0) >= 1

                    UNION ALL

                    SELECT
                        1 AS [row_priority],
                        document.[payload_json],
                        COALESCE(CONVERT(nvarchar(64), applicant.[id]), document.[id]) AS [table_id],
                        document.[id] AS [admin_record_id],
                        COALESCE(applicant.[national_id], JSON_VALUE(document.[payload_json], '$.nationalId')) AS [national_id],
                        COALESCE(applicant.[phone_number], JSON_VALUE(document.[payload_json], '$.phoneNumber'), JSON_VALUE(document.[payload_json], '$.contact.mobilePhone')) AS [phone_number],
                        COALESCE(applicant.[full_name], JSON_VALUE(document.[payload_json], '$.name')) AS [full_name],
                        COALESCE(applicant.[email], JSON_VALUE(document.[payload_json], '$.email'), JSON_VALUE(document.[payload_json], '$.contact.email')) AS [email],
                        COALESCE(applicant.[gender], JSON_VALUE(document.[payload_json], '$.gender')) AS [gender],
                        COALESCE(applicant.[religion], JSON_VALUE(document.[payload_json], '$.religion')) AS [religion],
                        COALESCE(applicant.[date_of_birth], TRY_CONVERT(date, JSON_VALUE(document.[payload_json], '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(document.[payload_json], '$.dateOfBirth'))) AS [date_of_birth],
                        COALESCE(applicant.[birth_governorate], JSON_VALUE(document.[payload_json], '$.birthGovernorate'), JSON_VALUE(document.[payload_json], '$.currentAddress.governorate'), JSON_VALUE(document.[payload_json], '$.governorate')) AS [birth_governorate],
                        COALESCE(applicant.[birth_district], JSON_VALUE(document.[payload_json], '$.birthDistrict'), JSON_VALUE(document.[payload_json], '$.currentAddress.city'), JSON_VALUE(document.[payload_json], '$.city')) AS [birth_district],
                        COALESCE(JSON_VALUE(document.[payload_json], '$.certType'), JSON_VALUE(document.[payload_json], '$.education.certificateName')) AS [certificate_type],
                        COALESCE(applicant.[source], JSON_VALUE(document.[payload_json], '$.source'), N'api') AS [source],
                        COALESCE(applicant.[created_at], document.[created_at]) AS [created_at],
                        document.[updated_at]
                    FROM {AdminDbContext.QualifiedTableName("applicant_management_records")} document
                    LEFT JOIN {ApplicantsIdentityTableName} applicant
                        ON applicant.[national_id] = JSON_VALUE(document.[payload_json], '$.nationalId')
                        OR CONVERT(nvarchar(64), applicant.[id]) = document.[id]
                    WHERE document.[module] = N'applicants'
                ) rows
                WHERE [admin_record_id] = @id OR [national_id] = @id OR [table_id] = @id
                ORDER BY [updated_at] DESC, [row_priority] DESC
                """,
                ct,
                command => AddParameter(command, "@id", id)),
            "grades" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], CONVERT(nvarchar(128), [seat]) AS [row_id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_grades")} WHERE CONVERT(nvarchar(128), [seat]) = @id OR [admin_record_id] = @id OR [nid] = @id",
                "row_id",
                ct,
                command => AddParameter(command, "@id", id)),
            "cycles" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("admission_cycles")} WHERE [id] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", id)),
            "categories" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [key] AS [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_categories")} WHERE [key] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", id)),
            "questions" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("exam_questions")} WHERE [id] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", id)),
            "exams" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("exams")} WHERE [id] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", id)),
            "settings" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("admin_settings")} WHERE [id] = N'settings'",
                "id",
                ct),
            "cycleApplicationSettings" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], [id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("cycle_application_settings")} WHERE [id] = @id",
                "id",
                ct,
                command => AddParameter(command, "@id", module)),
            _ => null
        };
        return rows?.FirstOrDefault();
    }

    private async Task<JsonObject?> UpsertNormalizedAsync(string module, string id, JsonObject payload, CancellationToken ct)
    {
        var kind = NormalizedModuleKind(module);
        payload["id"] ??= id;
        if (kind == "applicants")
        {
            NormalizeApplicantPayload(payload);
        }
        var payloadJson = payload.ToJsonString(AdminRecordJson.Options);
        var now = DateTimeOffset.UtcNow;

        switch (kind)
        {
            case "questions":
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {AdminDbContext.QualifiedTableName("exam_questions")} WITH (HOLDLOCK) AS target
                    USING (SELECT @id AS [id]) AS source
                    ON target.[id] = source.[id]
                    WHEN MATCHED THEN UPDATE SET
                        [category] = JSON_VALUE(@payload, '$.category'),
                        [difficulty] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.difficulty')),
                        [type] = JSON_VALUE(@payload, '$.type'),
                        [text] = JSON_VALUE(@payload, '$.text'),
                        [correct_index] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.correctIndex')),
                        [time_limit_seconds] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.timeLimitSeconds')),
                        [notes] = JSON_VALUE(@payload, '$.notes'),
                        [status] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'draft'),
                        [version] = COALESCE(TRY_CONVERT(int, JSON_VALUE(@payload, '$.version')), 1),
                        [image_url] = JSON_VALUE(@payload, '$.imageUrl'),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [category], [difficulty], [type], [text], [correct_index], [time_limit_seconds], [notes], [status], [version], [image_url], [payload_json], [created_at], [updated_at])
                    VALUES
                        (@id, JSON_VALUE(@payload, '$.category'), TRY_CONVERT(int, JSON_VALUE(@payload, '$.difficulty')), JSON_VALUE(@payload, '$.type'), JSON_VALUE(@payload, '$.text'),
                         TRY_CONVERT(int, JSON_VALUE(@payload, '$.correctIndex')), TRY_CONVERT(int, JSON_VALUE(@payload, '$.timeLimitSeconds')), JSON_VALUE(@payload, '$.notes'),
                         COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'draft'), COALESCE(TRY_CONVERT(int, JSON_VALUE(@payload, '$.version')), 1), JSON_VALUE(@payload, '$.imageUrl'), @payload, @now, @now);
                    DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_options")} WHERE [question_id] = @id;
                    INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_options")} ([question_id], [option_order], [option_text])
                    SELECT @id, TRY_CONVERT(int, [key]), CONVERT(nvarchar(max), [value]) FROM OPENJSON(@payload, '$.options');
                    DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_matching_pairs")} WHERE [question_id] = @id;
                    INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_matching_pairs")} ([question_id], [pair_order], [prompt], [match_text])
                    SELECT @id, TRY_CONVERT(int, [key]), JSON_VALUE([value], '$.prompt'), JSON_VALUE([value], '$.match') FROM OPENJSON(@payload, '$.matchingPairs');
                    """, command =>
                {
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                return await GetNormalizedAsync(module, id, ct);

            case "exams":
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {AdminDbContext.QualifiedTableName("exams")} WITH (HOLDLOCK) AS target
                    USING (SELECT @id AS [id]) AS source
                    ON target.[id] = source.[id]
                    WHEN MATCHED THEN UPDATE SET
                        [name_ar] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.nameAr'), N''), @id),
                        [cycle_id] = JSON_VALUE(@payload, '$.cycleId'),
                        [scheduled_for] = JSON_VALUE(@payload, '$.scheduledFor'),
                        [status] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'draft'),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [name_ar], [cycle_id], [scheduled_for], [status], [payload_json], [created_at], [updated_at])
                    VALUES
                        (@id, COALESCE(NULLIF(JSON_VALUE(@payload, '$.nameAr'), N''), @id), JSON_VALUE(@payload, '$.cycleId'), JSON_VALUE(@payload, '$.scheduledFor'),
                         COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'draft'), @payload, @now, @now);
                    DELETE FROM {AdminDbContext.QualifiedTableName("exam_rules")} WHERE [exam_id] = @id;
                    INSERT INTO {AdminDbContext.QualifiedTableName("exam_rules")} ([exam_id], [rule_order], [category], [difficulty_min], [difficulty_max], [question_count], [minutes])
                    SELECT @id, TRY_CONVERT(int, [key]), JSON_VALUE([value], '$.category'), TRY_CONVERT(int, JSON_VALUE([value], '$.difficultyMin')), TRY_CONVERT(int, JSON_VALUE([value], '$.difficultyMax')), TRY_CONVERT(int, JSON_VALUE([value], '$.count')), TRY_CONVERT(int, JSON_VALUE([value], '$.minutes'))
                    FROM OPENJSON(@payload, '$.rules');
                    DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_links")} WHERE [exam_id] = @id;
                    INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_links")} ([exam_id], [question_order], [question_id])
                    SELECT @id, TRY_CONVERT(int, [key]), CONVERT(nvarchar(128), [value]) FROM OPENJSON(@payload, '$.questionIds');
                    """, command =>
                {
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                return await GetNormalizedAsync(module, id, ct);

            case "settings":
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {AdminDbContext.QualifiedTableName("admin_settings")} WITH (HOLDLOCK) AS target
                    USING (SELECT N'settings' AS [id]) AS source
                    ON target.[id] = source.[id]
                    WHEN MATCHED THEN UPDATE SET
                        [exam_days_per_applicant] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.examDaysPerApplicant')),
                        [exam_slot_selection_window_days] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.examSlotSelectionWindowDays')),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [exam_days_per_applicant], [exam_slot_selection_window_days], [payload_json], [created_at], [updated_at])
                    VALUES
                        (N'settings', TRY_CONVERT(int, JSON_VALUE(@payload, '$.examDaysPerApplicant')), TRY_CONVERT(int, JSON_VALUE(@payload, '$.examSlotSelectionWindowDays')), @payload, @now, @now);
                    """, command =>
                {
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                return await GetNormalizedAsync(module, id, ct);

            case "applicants":
                var nationalId = AdminRecordJson.StringProp(payload, "nationalId")
                    ?? AdminRecordJson.StringProp(payload, "national_id")
                    ?? AdminRecordJson.StringProp(payload, "nid")
                    ?? throw new ConflictException("INVALID_APPLICANT_NID", "لا يمكن حفظ متقدم بدون رقم قومي");
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {ApplicantsIdentityTableName} WITH (HOLDLOCK) AS target
                    USING (SELECT @nationalId AS [national_id]) AS source
                    ON target.[national_id] COLLATE DATABASE_DEFAULT = source.[national_id] COLLATE DATABASE_DEFAULT
                    WHEN MATCHED THEN UPDATE SET
                        [phone_number] = COALESCE(JSON_VALUE(@payload, '$.phoneNumber'), JSON_VALUE(@payload, '$.phone_number'), JSON_VALUE(@payload, '$.contact.mobilePhone'), [phone_number]),
                        [full_name] = COALESCE(JSON_VALUE(@payload, '$.name'), [full_name]),
                        [email] = COALESCE(JSON_VALUE(@payload, '$.email'), JSON_VALUE(@payload, '$.contact.email'), [email]),
                        [gender] = COALESCE(JSON_VALUE(@payload, '$.gender'), [gender]),
                        [religion] = COALESCE(JSON_VALUE(@payload, '$.religion'), [religion]),
                        [date_of_birth] = COALESCE(TRY_CONVERT(date, JSON_VALUE(@payload, '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(@payload, '$.dateOfBirth')), [date_of_birth]),
                        [birth_governorate] = COALESCE(JSON_VALUE(@payload, '$.birthGovernorate'), JSON_VALUE(@payload, '$.currentAddress.governorate'), JSON_VALUE(@payload, '$.governorate'), [birth_governorate]),
                        [birth_district] = COALESCE(JSON_VALUE(@payload, '$.birthDistrict'), JSON_VALUE(@payload, '$.currentAddress.city'), JSON_VALUE(@payload, '$.city'), [birth_district]),
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [national_id], [phone_number], [full_name], [email], [gender], [religion], [date_of_birth], [birth_governorate], [birth_district], [source], [created_at], [updated_at])
                    VALUES
                        (NEWID(), @nationalId, COALESCE(JSON_VALUE(@payload, '$.phoneNumber'), JSON_VALUE(@payload, '$.phone_number'), JSON_VALUE(@payload, '$.contact.mobilePhone')),
                         JSON_VALUE(@payload, '$.name'), COALESCE(JSON_VALUE(@payload, '$.email'), JSON_VALUE(@payload, '$.contact.email')), JSON_VALUE(@payload, '$.gender'),
                         JSON_VALUE(@payload, '$.religion'), COALESCE(TRY_CONVERT(date, JSON_VALUE(@payload, '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(@payload, '$.dateOfBirth'))),
                         COALESCE(JSON_VALUE(@payload, '$.birthGovernorate'), JSON_VALUE(@payload, '$.currentAddress.governorate'), JSON_VALUE(@payload, '$.governorate')),
                         COALESCE(JSON_VALUE(@payload, '$.birthDistrict'), JSON_VALUE(@payload, '$.currentAddress.city'), JSON_VALUE(@payload, '$.city')),
                         N'api', @now, @now);
                    """, command =>
                {
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@nationalId", nationalId);
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                await UpsertDocumentMirrorAsync("applicants", id, payload, now, ct);
                return await GetNormalizedAsync(module, id, ct);

            case "cycleApplicationSettings":
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {AdminDbContext.QualifiedTableName("cycle_application_settings")} WITH (HOLDLOCK) AS target
                    USING (SELECT @id AS [id]) AS source
                    ON target.[id] = source.[id]
                    WHEN MATCHED THEN UPDATE SET
                        [cycle_id] = COALESCE(JSON_VALUE(@payload, '$.cycleId'), @cycleId),
                        [version] = COALESCE(TRY_CONVERT(int, JSON_VALUE(@payload, '$.version')), 1),
                        [updated_at_payload] = TRY_CONVERT(datetimeoffset, JSON_VALUE(@payload, '$.updatedAt')),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [cycle_id], [version], [updated_at_payload], [payload_json], [created_at], [updated_at])
                    VALUES
                        (@id, COALESCE(JSON_VALUE(@payload, '$.cycleId'), @cycleId), COALESCE(TRY_CONVERT(int, JSON_VALUE(@payload, '$.version')), 1), TRY_CONVERT(datetimeoffset, JSON_VALUE(@payload, '$.updatedAt')), @payload, @now, @now);

                    DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_values")} WHERE [cycle_setting_id] = @id;
                    DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_entries")} WHERE [cycle_setting_id] = @id;
                    DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_headers")} WHERE [cycle_setting_id] = @id;
                    INSERT INTO {AdminDbContext.QualifiedTableName("cycle_application_setting_headers")}
                        ([cycle_setting_id], [category_key], [application_start], [application_end], [age_reference_date], [age_min], [max_age], [grade_kind], [min_percentage], [academic_grade_id], [payload_json])
                    SELECT @id, header.[key], TRY_CONVERT(date, JSON_VALUE(header.[value], '$.applicationStart')), TRY_CONVERT(date, JSON_VALUE(header.[value], '$.applicationEnd')),
                           TRY_CONVERT(date, JSON_VALUE(header.[value], '$.ageReferenceDate')), TRY_CONVERT(int, JSON_VALUE(header.[value], '$.ageMin')), TRY_CONVERT(int, JSON_VALUE(header.[value], '$.maxAge')),
                           JSON_VALUE(header.[value], '$.gradeKind'), TRY_CONVERT(decimal(7,2), JSON_VALUE(header.[value], '$.minPercentage')), JSON_VALUE(header.[value], '$.academicGradeId'), CONVERT(nvarchar(max), header.[value])
                    FROM OPENJSON(@payload, '$.headers') AS header;

                    INSERT INTO {AdminDbContext.QualifiedTableName("cycle_application_setting_values")} ([cycle_setting_id], [category_key], [value_group], [value_order], [value])
                    SELECT @id, header.[key], groups.[value_group], TRY_CONVERT(int, item.[key]), CONVERT(nvarchar(256), item.[value])
                    FROM OPENJSON(@payload, '$.headers') AS header
                    CROSS APPLY (VALUES
                        (N'graduationYears', JSON_QUERY(header.[value], '$.graduationYears')),
                        (N'maritalStatus', JSON_QUERY(header.[value], '$.maritalStatus')),
                        (N'divisions', JSON_QUERY(header.[value], '$.divisions')),
                        (N'schoolCategories', JSON_QUERY(header.[value], '$.schoolCategories')),
                        (N'genderTypes', JSON_QUERY(header.[value], '$.genderTypes'))
                    ) AS groups([value_group], [json_array])
                    CROSS APPLY OPENJSON(groups.[json_array]) AS item
                    WHERE groups.[json_array] IS NOT NULL;

                    INSERT INTO {AdminDbContext.QualifiedTableName("cycle_application_setting_entries")} ([cycle_setting_id], [entry_group], [entry_order], [entry_id], [category_key], [payload_json])
                    SELECT @id, N'local', TRY_CONVERT(int, entry.[key]), JSON_VALUE(entry.[value], '$.id'), JSON_VALUE(entry.[value], '$.category'), CONVERT(nvarchar(max), entry.[value])
                    FROM OPENJSON(@payload, '$.local') AS entry
                    UNION ALL
                    SELECT @id, N'approved', TRY_CONVERT(int, entry.[key]), JSON_VALUE(entry.[value], '$.id'), JSON_VALUE(entry.[value], '$.category'), CONVERT(nvarchar(max), entry.[value])
                    FROM OPENJSON(@payload, '$.approved') AS entry;
                    """, command =>
                {
                    AddParameter(command, "@id", module);
                    AddParameter(command, "@cycleId", module.Replace("admissionSetup.applicationSettings.", "", StringComparison.Ordinal));
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                return await GetNormalizedAsync(module, id, ct);

            case "grades":
                if (AdminRecordJson.StringProp(payload, "nid") is not { Length: 14 } nid)
                    throw new ConflictException("INVALID_GRADE_NID", "لا يمكن حفظ درجة بدون رقم قومي صحيح");
                await ExecuteNormalizedNonQueryAsync($"""
                    MERGE {AdminDbContext.QualifiedTableName("applicant_grades")} WITH (HOLDLOCK) AS target
                    USING (SELECT @nid AS [nid]) AS source
                    ON target.[nid] COLLATE DATABASE_DEFAULT = source.[nid] COLLATE DATABASE_DEFAULT
                    WHEN MATCHED THEN UPDATE SET
                        [admin_record_id] = @id,
                        [seat] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.seat')),
                        [seating_number] = JSON_VALUE(@payload, '$.seatingNumber'),
                        [name] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.name'), N''), JSON_VALUE(@payload, '$.nameAr')),
                        [kind] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.kind'), N''), N'general'),
                        [gender] = JSON_VALUE(@payload, '$.gender'),
                        [branch] = JSON_VALUE(@payload, '$.branch'),
                        [graduation_year] = TRY_CONVERT(int, JSON_VALUE(@payload, '$.graduationYear')),
                        [school_category_code] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.schoolCategoryCode'), N''), NULLIF(JSON_VALUE(@payload, '$.schoolCategory'), N'')),
                        [school] = JSON_VALUE(@payload, '$.school'),
                        [region] = JSON_VALUE(@payload, '$.region'),
                        [exam_round] = JSON_VALUE(@payload, '$.examRound'),
                        [total] = TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.total')),
                        [import_max] = TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.importMax')),
                        [override_max] = TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.overrideMax')),
                        [last_edited_at] = JSON_VALUE(@payload, '$.lastEditedAt'),
                        [last_edited_by] = JSON_VALUE(@payload, '$.lastEditedBy'),
                        [grade_changed_at] = TRY_CONVERT(datetimeoffset, JSON_VALUE(@payload, '$.gradeChangedAt')),
                        [previous_grade] = TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.previousGrade')),
                        [status] = COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'مستجد'),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [admin_record_id], [seat], [seating_number], [nid], [name], [kind], [gender], [branch], [graduation_year], [school_category_code], [school], [region], [exam_round], [total], [import_max], [override_max], [last_edited_at], [last_edited_by], [grade_changed_at], [previous_grade], [status], [payload_json], [created_at], [updated_at])
                    VALUES
                        (NEWID(), @id, TRY_CONVERT(int, JSON_VALUE(@payload, '$.seat')), JSON_VALUE(@payload, '$.seatingNumber'), @nid,
                         COALESCE(NULLIF(JSON_VALUE(@payload, '$.name'), N''), JSON_VALUE(@payload, '$.nameAr')), COALESCE(NULLIF(JSON_VALUE(@payload, '$.kind'), N''), N'general'),
                         JSON_VALUE(@payload, '$.gender'), JSON_VALUE(@payload, '$.branch'), TRY_CONVERT(int, JSON_VALUE(@payload, '$.graduationYear')),
                         COALESCE(NULLIF(JSON_VALUE(@payload, '$.schoolCategoryCode'), N''), NULLIF(JSON_VALUE(@payload, '$.schoolCategory'), N'')), JSON_VALUE(@payload, '$.school'),
                         JSON_VALUE(@payload, '$.region'), JSON_VALUE(@payload, '$.examRound'), TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.total')),
                         TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.importMax')), TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.overrideMax')),
                         JSON_VALUE(@payload, '$.lastEditedAt'), JSON_VALUE(@payload, '$.lastEditedBy'), TRY_CONVERT(datetimeoffset, JSON_VALUE(@payload, '$.gradeChangedAt')),
                         TRY_CONVERT(decimal(7,2), JSON_VALUE(@payload, '$.previousGrade')), COALESCE(NULLIF(JSON_VALUE(@payload, '$.status'), N''), N'مستجد'), @payload, @now, @now);
                    """, command =>
                {
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@nid", nid);
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
                return await GetNormalizedAsync(module, id, ct);
        }

        return null;
    }

    private async Task UpsertDocumentMirrorAsync(
        string module,
        string id,
        JsonObject payload,
        DateTimeOffset now,
        CancellationToken ct)
    {
        await operationalRecords.UpsertAsync(module, id, payload, ct);
    }

    private async Task<IReadOnlyList<JsonObject>> QueryPayloadRowsAsync(
        string sql,
        string idColumn,
        CancellationToken ct,
        Action<DbCommand>? bind = null)
    {
        return await ExecuteNormalizedQueryAsync(sql, bind, reader =>
        {
            var payload = reader.IsDBNull(0) ? new JsonObject() : AdminRecordJson.Parse(reader.GetString(0));
            var id = reader.IsDBNull(1) ? null : reader.GetString(1);
            if (!string.IsNullOrWhiteSpace(id)) payload["id"] ??= id;
            payload["createdAt"] ??= reader.GetFieldValue<DateTimeOffset>(2);
            payload["updatedAt"] ??= reader.GetFieldValue<DateTimeOffset>(3);
            return payload;
        }, ct);
    }

    private async Task<IReadOnlyList<JsonObject>> QueryApplicantRowsAsync(
        string sql,
        CancellationToken ct,
        Action<DbCommand>? bind = null)
    {
        return await ExecuteNormalizedQueryAsync(sql, bind, reader =>
        {
            var payload = reader.IsDBNull(0) ? new JsonObject() : AdminRecordJson.Parse(reader.GetString(0));
            var identity = new ApplicantIdentityProjection(
                TableId: ReadString(reader, 1) ?? "",
                AdminRecordId: ReadString(reader, 2),
                NationalId: ReadString(reader, 3),
                PhoneNumber: ReadString(reader, 4),
                FullName: ReadString(reader, 5),
                Email: ReadString(reader, 6),
                Gender: ReadString(reader, 7),
                Religion: ReadString(reader, 8),
                BirthDate: reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTime>(9).ToString("yyyy-MM-dd"),
                BirthGovernorate: ReadString(reader, 10),
                BirthDistrict: ReadString(reader, 11),
                CertificateType: ReadString(reader, 12),
                Source: ReadString(reader, 13),
                CreatedAt: reader.GetFieldValue<DateTimeOffset>(14),
                UpdatedAt: reader.GetFieldValue<DateTimeOffset>(15));

            return ProjectApplicantManagementPayload(payload, identity);
        }, ct);
    }

    internal static JsonObject ProjectApplicantManagementPayload(JsonObject payload, ApplicantIdentityProjection identity)
    {
        var projected = payload.DeepClone().AsObject();
        var profile = ObjectProp(projected, "profile");
        var family = ObjectProp(projected, "family");
        var examSlot = ObjectProp(projected, "examSlot");
        var payment = ObjectProp(projected, "payment");
        var stage = IntProp(projected, "stage") ?? IntProp(projected, "furthestStage");

        projected["applicantTableId"] = identity.TableId;
        if (!string.IsNullOrWhiteSpace(identity.AdminRecordId)) projected["adminRecordId"] = identity.AdminRecordId;
        projected["id"] ??= identity.AdminRecordId ?? identity.TableId;
        SetIfPresent(projected, "nationalId", StringProp(profile, "nationalId") ?? identity.NationalId);
        SetIfPresent(projected, "phoneNumber", StringProp(profile, "mobile") ?? identity.PhoneNumber);
        SetIfPresent(projected, "name", StringProp(profile, "fullName") ?? identity.FullName);
        SetIfPresent(projected, "email", StringProp(profile, "email") ?? identity.Email);
        SetIfPresent(projected, "gender", StringProp(profile, "gender") ?? identity.Gender);
        SetIfPresent(projected, "religion", StringProp(profile, "religion") ?? identity.Religion);
        SetIfPresent(projected, "birthDate", StringProp(profile, "dateOfBirth") ?? identity.BirthDate);
        SetIfPresent(projected, "birthGovernorate", StringProp(profile, "birthGovernorate") ?? identity.BirthGovernorate);
        SetIfPresent(projected, "birthDistrict", StringProp(profile, "birthDistrict") ?? identity.BirthDistrict);
        SetIfPresent(projected, "maritalStatus", MaritalStatusLabel(StringProp(profile, "maritalStatus")));
        ApplyPortalProfileSections(projected, profile);
        SetIfPresent(
            projected,
            "certType",
            PortalCertificateType(profile)
                ?? identity.CertificateType
                ?? StringProp(profile, "certificateName")
                ?? StringProp(profile, "qualificationLevel"));
        SetIfPresent(projected, "certSection", StringProp(profile, "thanawiType"));
        SetIfPresent(projected, "governorate", StringProp(profile, "addressGovernorate"));
        SetIfPresent(projected, "city", StringProp(profile, "addressDistrict"));
        SetIfPresent(projected, "department", DepartmentFromPortalCategory(projected));
        ApplyPortalFamilySections(projected, family);

        if (stage is > 0)
        {
            projected["stage"] = stage.Value;
            projected["stageLabel"] ??= ApplicantStageLabels.TryGetValue(stage.Value, out var label)
                ? label
                : "مرحلة غير محددة";
        }

        if (stage >= 8)
        {
            projected["status"] ??= "under-review";
        }
        else
        {
            projected["status"] ??= "pending";
        }

        projected["paymentStatus"] ??= payment is null ? "pending" : "paid";
        SetNumberIfMissing(projected, "paymentAmount", NumberProp(payment, "amount"));
        SetIfPresent(projected, "firstExamDate", StringProp(examSlot, "date"));
        SetIfPresent(projected, "committee", StringProp(examSlot, "location"));
        projected["registeredAt"] ??= identity.CreatedAt;
        projected["createdAt"] ??= identity.CreatedAt;
        projected["updatedAt"] ??= identity.UpdatedAt;
        projected["source"] = HasPortalDraftShape(payload)
            ? "applicant-portal"
            : AdminRecordJson.StringProp(projected, "source") ?? identity.Source ?? "api";

        return projected;
    }

    private static bool HasPortalDraftShape(JsonObject payload) =>
        payload.ContainsKey("furthestStage") || payload.ContainsKey("profile") || payload.ContainsKey("examSlot");

    private static JsonObject? ObjectProp(JsonObject? obj, string key) =>
        obj is not null && obj.TryGetPropertyValue(key, out var node) && node is JsonObject child ? child : null;

    private static JsonArray? ArrayProp(JsonObject? obj, string key) =>
        obj is not null && obj.TryGetPropertyValue(key, out var node) && node is JsonArray child ? child : null;

    private static string? StringProp(JsonObject? obj, string key) =>
        obj is null ? null : AdminRecordJson.StringProp(obj, key);

    private static int? IntProp(JsonObject obj, string key) =>
        AdminRecordJson.NumberProp(obj, key) is { } value ? Convert.ToInt32(value) : null;

    private static bool? BoolProp(JsonObject? obj, string key)
    {
        if (obj is null || !obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        if (node.GetValueKind() == System.Text.Json.JsonValueKind.True) return true;
        if (node.GetValueKind() == System.Text.Json.JsonValueKind.False) return false;
        return bool.TryParse(node.ToString(), out var parsed) ? parsed : null;
    }

    private static void ApplyPortalProfileSections(JsonObject projected, JsonObject? profile)
    {
        if (profile is null) return;

        var currentAddress = ObjectProp(projected, "currentAddress")?.DeepClone().AsObject() ?? [];
        SetIfPresent(currentAddress, "governorate", StringProp(profile, "addressGovernorate"));
        SetIfPresent(currentAddress, "city", StringProp(profile, "addressDistrict"));
        SetIfPresent(currentAddress, "detail", StringProp(profile, "currentAddressDetail"));
        if (currentAddress.Count > 0) projected["currentAddress"] = currentAddress;

        var contact = ObjectProp(projected, "contact")?.DeepClone().AsObject() ?? [];
        SetIfPresent(contact, "mobilePhone", StringProp(profile, "mobile"));
        SetIfPresent(contact, "homePhone", StringProp(profile, "homePhone"));
        SetIfPresent(contact, "email", StringProp(profile, "email"));
        SetIfPresent(contact, "socialFacebook", StringProp(profile, "facebook"));
        SetIfPresent(contact, "socialInstagram", StringProp(profile, "instagram"));
        SetIfPresent(contact, "socialX", StringProp(profile, "twitter"));
        if (contact.Count > 0) projected["contact"] = contact;

        var education = BuildPortalEducation(profile);
        if (education is not null) projected["education"] = education;
    }

    private static void ApplyPortalFamilySections(JsonObject projected, JsonObject? family)
    {
        var portalFamily = BuildPortalFamily(family);
        if (portalFamily is null) return;

        projected["family"] = portalFamily;
        projected["familySize"] = CountFamilyMembers(portalFamily);
        projected["relativesCount"] = ArrayProp(portalFamily, "relatives")?.Count ?? 0;
    }

    private static JsonObject? BuildPortalFamily(JsonObject? family)
    {
        if (family is null) return null;

        var result = new JsonObject();
        SetObjectIfPresent(result, "father", BuildPortalFamilyMember(ObjectProp(family, "father")));
        SetObjectIfPresent(result, "mother", BuildPortalFamilyMember(ObjectProp(family, "mother")));

        var grandparents = ObjectProp(family, "grandparents");
        SetObjectIfPresent(result, "paternalGrandfather", BuildPortalFamilyMember(ObjectProp(grandparents, "paternalGrandfather")));
        SetObjectIfPresent(result, "paternalGrandmother", BuildPortalFamilyMember(ObjectProp(grandparents, "paternalGrandmother")));
        SetObjectIfPresent(result, "maternalGrandfather", BuildPortalFamilyMember(ObjectProp(grandparents, "maternalGrandfather")));
        SetObjectIfPresent(result, "maternalGrandmother", BuildPortalFamilyMember(ObjectProp(grandparents, "maternalGrandmother")));

        var fatherWives = BuildPortalFamilyMemberArray(ArrayProp(family, "fatherWives"), "زوجة الأب");
        if (fatherWives.Count > 0) result["fatherWives"] = fatherWives;

        var motherHusbands = BuildPortalFamilyMemberArray(ArrayProp(family, "motherHusbands"), "زوج الأم");
        if (motherHusbands.Count > 0) result["motherHusbands"] = motherHusbands;

        var relatives = ObjectProp(family, "relatives");
        var siblings = new JsonArray();
        AddPortalRelativeMembers(siblings, relatives, "brothers", "الأخ");
        AddPortalRelativeMembers(siblings, relatives, "sisters", "الأخت");
        if (siblings.Count > 0) result["siblings"] = siblings;

        var extendedRelatives = new JsonArray();
        AddPortalRelativeMembers(extendedRelatives, relatives, "paternal_uncles", "العم");
        AddPortalRelativeMembers(extendedRelatives, relatives, "paternal_aunts", "العمة");
        AddPortalRelativeMembers(extendedRelatives, relatives, "maternal_uncles", "الخال");
        AddPortalRelativeMembers(extendedRelatives, relatives, "maternal_aunts", "الخالة");
        if (extendedRelatives.Count > 0) result["relatives"] = extendedRelatives;

        SetObjectIfPresent(result, "guardian", BuildPortalGuardian(ObjectProp(family, "guardian")));

        return result.Count > 0 ? result : null;
    }

    private static JsonArray BuildPortalFamilyMemberArray(JsonArray? members, string relationshipId)
    {
        var result = new JsonArray();
        if (members is null) return result;
        foreach (var node in members)
        {
            if (node is JsonObject member)
            {
                var projected = BuildPortalFamilyMember(member, relationshipId);
                if (projected is not null) result.Add(projected);
            }
        }
        return result;
    }

    private static void AddPortalRelativeMembers(JsonArray target, JsonObject? relatives, string key, string relationshipId)
    {
        foreach (var node in ArrayProp(relatives, key) ?? [])
        {
            if (node is JsonObject member)
            {
                var projected = BuildPortalFamilyMember(member, relationshipId);
                if (projected is not null) target.Add(projected);
            }
        }
    }

    private static JsonObject? BuildPortalFamilyMember(JsonObject? member, string? relationshipId = null)
    {
        if (member is null) return null;

        var fullName = JoinedPortalPersonName(member);
        var nationalId = BoolProp(member, "nidUnavailable") == true ? null : StringProp(member, "nationalId");
        if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(nationalId)) return null;

        var result = new JsonObject
        {
            ["fullName"] = fullName ?? nationalId,
            ["alive"] = BoolProp(member, "deceased") != true
        };
        SetIfPresent(result, "nationalId", nationalId);
        SetIfPresent(result, "occupation", ProfessionLabel(StringProp(member, "profession"), StringProp(member, "professionDetail")));
        SetIfPresent(result, "governorate", StringProp(member, "residenceGovernorate") ?? StringProp(member, "birthGovernorate"));
        SetIfPresent(result, "education", QualificationLabel(StringProp(member, "qualification"), StringProp(member, "qualificationDetail")));
        SetIfPresent(result, "relationshipId", relationshipId);
        return result;
    }

    private static JsonObject? BuildPortalGuardian(JsonObject? guardian)
    {
        if (guardian is null) return null;
        var fullName = JoinedPortalPersonName(guardian);
        if (string.IsNullOrWhiteSpace(fullName)) return null;

        var result = new JsonObject
        {
            ["fullName"] = fullName,
            ["alive"] = true
        };
        SetIfPresent(result, "occupation", ProfessionLabel(StringProp(guardian, "profession"), StringProp(guardian, "professionDetail")));
        SetIfPresent(result, "education", QualificationLabel(StringProp(guardian, "qualification"), StringProp(guardian, "qualificationDetail")));
        SetIfPresent(result, "governorate", StringProp(guardian, "workplaceDetail"));
        SetIfPresent(result, "relationshipId", "ولي الأمر");
        return result;
    }

    private static string? JoinedPortalPersonName(JsonObject person)
    {
        var parts = new[]
        {
            StringProp(person, "firstName"),
            StringProp(person, "secondName"),
            StringProp(person, "thirdName")
        }.Where(part => !string.IsNullOrWhiteSpace(part));
        var joined = string.Join(" ", parts);
        return string.IsNullOrWhiteSpace(joined) ? null : joined;
    }

    private static string? ProfessionLabel(string? code, string? detail) =>
        code switch
        {
            "police_officer" => WithDetail("ضابط شرطة", detail),
            "army_officer" => WithDetail("ضابط جيش", detail),
            "doctor" => WithDetail("طبيب", detail),
            "engineer" => WithDetail("مهندس", detail),
            "teacher" => WithDetail("معلّم", detail),
            "lawyer" => WithDetail("محامي", detail),
            "merchant" => WithDetail("تاجر", detail),
            "gov_employee" => WithDetail("موظف حكومي", detail),
            "private_employee" => WithDetail("موظف قطاع خاص", detail),
            "retired" => WithDetail("متقاعد", detail),
            "housewife" => WithDetail("ربة منزل", detail),
            "other" => detail,
            _ => detail ?? code
        };

    private static string? QualificationLabel(string? code, string? detail) =>
        code switch
        {
            "none" => WithDetail("بدون مؤهل", detail),
            "primary" => WithDetail("ابتدائي", detail),
            "preparatory" => WithDetail("إعدادي", detail),
            "secondary" => WithDetail("ثانوي", detail),
            "diploma" => WithDetail("دبلوم", detail),
            "bachelor" => WithDetail("بكالوريوس / ليسانس", detail),
            "masters" => WithDetail("ماجستير", detail),
            "phd" => WithDetail("دكتوراه", detail),
            "other" => detail,
            _ => detail ?? code
        };

    private static string? WithDetail(string label, string? detail) =>
        string.IsNullOrWhiteSpace(detail) ? label : $"{label} · {detail}";

    private static void SetObjectIfPresent(JsonObject payload, string key, JsonObject? value)
    {
        if (value is not null)
        {
            payload[key] = value;
        }
    }

    private static int CountFamilyMembers(JsonObject family)
    {
        var count = 0;
        foreach (var key in new[]
        {
            "father",
            "mother",
            "paternalGrandfather",
            "paternalGrandmother",
            "maternalGrandfather",
            "maternalGrandmother",
            "guardian"
        })
        {
            if (ObjectProp(family, key) is not null) count++;
        }
        count += ArrayProp(family, "fatherWives")?.Count ?? 0;
        count += ArrayProp(family, "motherHusbands")?.Count ?? 0;
        count += ArrayProp(family, "siblings")?.Count ?? 0;
        return count;
    }

    private static JsonObject? BuildPortalEducation(JsonObject profile)
    {
        var qualificationLevel = StringProp(profile, "qualificationLevel");
        var hasHigherFields =
            !string.IsNullOrWhiteSpace(qualificationLevel)
            || !string.IsNullOrWhiteSpace(StringProp(profile, "bachelorUniversity"))
            || !string.IsNullOrWhiteSpace(StringProp(profile, "bachelorFaculty"))
            || !string.IsNullOrWhiteSpace(StringProp(profile, "bachelorSpecialization"));

        if (hasHigherFields)
        {
            var secondary = new JsonObject();
            SetIfPresent(secondary, "certificateName", ThanawiCertificateName(profile));
            SetNumberIfPresent(secondary, "totalScore", NumberProp(profile, "thanawiTotal"));
            SetIfPresent(secondary, "schoolCategory", StringProp(profile, "thanawiType"));
            SetIfPresent(secondary, "country", StringProp(profile, "thanawiCountry"));
            SetNumberIfPresent(secondary, "percentage", NumberProp(profile, "thanawiPercentage"));

            var education = new JsonObject
            {
                ["kind"] = "higher",
                ["secondary"] = secondary,
            };
            SetIfPresent(education, "specialization", StringProp(profile, "bachelorSpecialization") ?? StringProp(profile, "bachelorMajor"));
            SetIfPresent(education, "university", StringProp(profile, "bachelorUniversity"));
            SetIfPresent(education, "faculty", StringProp(profile, "bachelorFaculty"));
            SetNumberIfPresent(education, "totalScore", NumberProp(profile, "bachelorPercentage"));
            SetIfPresent(education, "grade", StringProp(profile, "bachelorGrade"));
            SetIfPresent(education, "higherSpecialization", StringProp(profile, "qualificationLevel"));
            SetNumberIfPresent(education, "graduationYear", NumberProp(profile, "bachelorYear"));
            return education;
        }

        if (StringProp(profile, "thanawiTotal") is null
            && StringProp(profile, "schoolNameAr") is null
            && StringProp(profile, "thanawiType") is null)
        {
            return null;
        }

        var general = new JsonObject
        {
            ["kind"] = "general",
        };
        SetIfPresent(general, "certificateName", ThanawiCertificateName(profile));
        SetIfPresent(general, "schoolName", StringProp(profile, "schoolNameAr"));
        SetNumberIfPresent(general, "totalScore", NumberProp(profile, "thanawiTotal"));
        SetIfPresent(general, "branch", StringProp(profile, "thanawiType"));
        SetIfPresent(general, "schoolCategory", StringProp(profile, "thanawiType"));
        SetNumberIfPresent(general, "graduationYear", GraduationYear(profile));
        SetNumberIfPresent(general, "percentage", NumberProp(profile, "thanawiPercentage"));
        return general;
    }

    private static string? PortalCertificateType(JsonObject? profile)
    {
        if (profile is null) return null;
        var qualificationLevel = StringProp(profile, "qualificationLevel");
        return qualificationLevel switch
        {
            "license" or "bachelor" => "مؤهل جامعي",
            "master" => "ماجستير",
            "doctorate" => "دكتوراه",
            _ => ThanawiCertificateName(profile)
        };
    }

    private static string? ThanawiCertificateName(JsonObject profile) =>
        StringProp(profile, "thanawiType") is { } type
            ? $"الثانوية العامة أو ما يعادلها · {type}"
            : "الثانوية العامة أو ما يعادلها";

    private static string? MaritalStatusLabel(string? value) =>
        value switch
        {
            "single" => "أعزب",
            "married" => "متزوج",
            "divorced" => "مطلق",
            "widowed" => "أرمل",
            _ => value
        };

    private static string? DepartmentFromPortalCategory(JsonObject projected)
    {
        var categoryKey = StringProp(projected, "categoryKey");
        if (!string.IsNullOrWhiteSpace(StringProp(projected, "department"))) return null;
        return categoryKey switch
        {
            "officers_general" => "general_first",
            "law_bachelor" => "lawyers",
            "specialized_officers" => QualificationDepartment(StringProp(ObjectProp(projected, "profile"), "qualificationLevel")),
            _ => null
        };
    }

    private static string QualificationDepartment(string? qualificationLevel) =>
        qualificationLevel switch
        {
            "master" => "masters",
            "doctorate" => "doctorate",
            _ => "special"
        };

    private static double? NumberProp(JsonObject? obj, string key) =>
        obj is null ? null : AdminRecordJson.NumberProp(obj, key);

    private static double? GraduationYear(JsonObject profile)
    {
        if (StringProp(profile, "thanawiGradDate") is { } date
            && DateTime.TryParse(date, out var parsed))
        {
            return parsed.Year;
        }

        return null;
    }

    private static void SetNumberIfPresent(JsonObject payload, string key, double? value)
    {
        if (value is not null)
        {
            payload[key] = value.Value;
        }
    }

    private static void SetNumberIfMissing(JsonObject payload, string key, double? value)
    {
        if (value is not null && !payload.ContainsKey(key))
        {
            payload[key] = value.Value;
        }
    }

    private static string? ReadString(DbDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);

    private static void NormalizeApplicantPayload(JsonObject payload)
    {
        var fullName = AdminRecordJson.StringProp(payload, "name") ?? JoinedFullName(payload);
        SetIfPresent(payload, "name", fullName);
        SetIfPresent(payload, "phoneNumber", NestedString(payload, "contact", "mobilePhone"));
        SetIfPresent(payload, "email", NestedString(payload, "contact", "email"));
        SetIfPresent(payload, "governorate", NestedString(payload, "currentAddress", "governorate"));
        SetIfPresent(payload, "city", NestedString(payload, "currentAddress", "city"));
        SetIfPresent(payload, "certType", NestedString(payload, "education", "certificateName"));

        if (AdminRecordJson.StringProp(payload, "nationalId") is { Length: 14 } nationalId &&
            NationalIdParser.TryParseEgyptianNationalId(nationalId, out var info, out _))
        {
            payload["birthDate"] ??= info.BirthDate.ToString("yyyy-MM-dd");
            payload["gender"] ??= info.Gender == EgyptianNationalIdGender.Male ? "male" : "female";
            payload["birthGovernorate"] ??= GovernorateNameFromNationalIdCode(info.GovernorateCode);
        }
    }

    private static string GovernorateNameFromNationalIdCode(string code)
        => code switch
        {
            "01" => "محافظة القاهرة",
            "02" => "محافظة الإسكندرية",
            "03" => "محافظة بورسعيد",
            "04" => "محافظة السويس",
            "11" => "محافظة دمياط",
            "12" => "محافظة الدقهلية",
            "13" => "محافظة الشرقية",
            "14" => "محافظة القليوبية",
            "15" => "محافظة كفر الشيخ",
            "16" => "محافظة الغربية",
            "17" => "محافظة المنوفية",
            "18" => "محافظة البحيرة",
            "19" => "محافظة الإسماعيلية",
            "21" => "محافظة الجيزة",
            "22" => "محافظة بني سويف",
            "23" => "محافظة الفيوم",
            "24" => "محافظة المنيا",
            "25" => "محافظة أسيوط",
            "26" => "محافظة سوهاج",
            "27" => "محافظة قنا",
            "28" => "محافظة أسوان",
            "29" => "محافظة الأقصر",
            "31" => "محافظة البحر الأحمر",
            "32" => "محافظة الوادي الجديد",
            "33" => "محافظة مطروح",
            "34" => "محافظة شمال سيناء",
            "35" => "محافظة جنوب سيناء",
            "88" => "خارج الجمهورية",
            _ => code,
        };

    private static string? JoinedFullName(JsonObject payload)
    {
        if (!payload.TryGetPropertyValue("fullName", out var node) || node is not JsonObject fullName)
            return null;

        var parts = new[]
        {
            AdminRecordJson.StringProp(fullName, "first"),
            AdminRecordJson.StringProp(fullName, "second"),
            AdminRecordJson.StringProp(fullName, "third"),
            AdminRecordJson.StringProp(fullName, "fourth")
        }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part!.Trim())
            .ToArray();

        return parts.Length == 0 ? null : string.Join(' ', parts);
    }

    private static string? NestedString(JsonObject payload, string objectKey, string key)
    {
        if (!payload.TryGetPropertyValue(objectKey, out var node) || node is not JsonObject child)
            return null;

        return AdminRecordJson.StringProp(child, key);
    }

    private static void SetIfPresent(JsonObject payload, string key, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            payload[key] = value;
        }
    }

    private async Task<bool> ApplicantHasGradeAsync(string nationalId, CancellationToken ct)
    {
        var rows = await ListAsync("grades", ct);
        return rows.Any(row =>
            !AdminRecordJson.IsSoftDeleted(row)
            && (AdminRecordJson.StringProp(row, "nid") == nationalId
                || AdminRecordJson.StringProp(row, "nationalId") == nationalId
                || AdminRecordJson.StringProp(row, "national_id") == nationalId));
    }

    private static void ClearApplicantEnteredData(JsonObject payload)
    {
        string[] keys =
        [
            "manualPersonalJson",
            "manual_personal_json",
            "manualPersonal",
            "socialHandlesJson",
            "social_handles_json",
            "socialHandles",
            "applicantAddress",
            "applicant_address",
            "currentAddress",
            "address",
            "applicantEducation",
            "applicant_education",
            "family",
            "applicantFamilyMembers",
            "applicant_family_members",
            "examReservations",
            "applicantExamReservations",
            "applicant_exam_reservations",
            "paymentRefNumber",
            "payment_ref_number",
            "paymentReference",
            "paidAt",
            "paid_at",
            "parentsApproved",
            "parents_approved",
            "parentsApprovedAt",
            "parents_approved_at",
            "parentsApprovedBy",
            "parents_approved_by",
            "firstExamDate",
            "first_exam_date",
            "attendanceCardPrintedAt",
            "attendance_card_printed_at"
        ];

        foreach (var key in keys)
        {
            payload.Remove(key);
        }
    }

    private async Task<IReadOnlyList<JsonObject>> ExecuteNormalizedQueryAsync(
        string sql,
        Action<DbCommand>? bind,
        Func<DbDataReader, JsonObject> map,
        CancellationToken ct)
    {
        var context = (DbContext)db;
        var connection = context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 120;
        bind?.Invoke(command);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<JsonObject>();
        while (await reader.ReadAsync(ct)) rows.Add(map(reader));
        return rows;
    }

    private async Task ExecuteNormalizedNonQueryAsync(
        string sql,
        Action<DbCommand> bind,
        CancellationToken ct)
    {
        _ = await ExecuteNormalizedNonQueryWithCountAsync(sql, bind, ct);
    }

    private async Task<int> ExecuteNormalizedNonQueryWithCountAsync(
        string sql,
        Action<DbCommand> bind,
        CancellationToken ct)
    {
        var context = (DbContext)db;
        var connection = context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 120;
        bind(command);
        return await command.ExecuteNonQueryAsync(ct);
    }

    private async Task<bool> DeleteNormalizedAsync(string module, string id, CancellationToken ct)
    {
        var kind = NormalizedModuleKind(module);
        var affected = kind switch
        {
            "applicants" => await ExecuteNormalizedNonQueryWithCountAsync(
                $"""
                DELETE FROM {AdminDbContext.QualifiedTableName("applicant_management_records")}
                WHERE [module] = N'applicants' AND [id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("applicant_portal_records")}
                WHERE [applicant_id] = @id
                   OR [applicant_id] IN (
                       SELECT CONVERT(nvarchar(64), [id])
                       FROM {ApplicantsIdentityTableName}
                       WHERE [national_id] = @id
                   );
                DELETE FROM {ApplicantsIdentityTableName}
                WHERE [national_id] = @id OR CONVERT(nvarchar(64), [id]) = @id;
                """,
                command => AddParameter(command, "@id", id),
                ct),
            "questions" => await ExecuteNormalizedNonQueryWithCountAsync(
                $"""
                DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_options")} WHERE [question_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_matching_pairs")} WHERE [question_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("exam_questions")} WHERE [id] = @id;
                """,
                command => AddParameter(command, "@id", id),
                ct),
            "exams" => await ExecuteNormalizedNonQueryWithCountAsync(
                $"""
                DELETE FROM {AdminDbContext.QualifiedTableName("exam_rules")} WHERE [exam_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("exam_question_links")} WHERE [exam_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("exams")} WHERE [id] = @id;
                """,
                command => AddParameter(command, "@id", id),
                ct),
            "settings" => await ExecuteNormalizedNonQueryWithCountAsync(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("admin_settings")} WHERE [id] = N'settings'",
                _ => { },
                ct),
            "cycleApplicationSettings" => await ExecuteNormalizedNonQueryWithCountAsync(
                $"""
                DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_values")} WHERE [cycle_setting_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_entries")} WHERE [cycle_setting_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_setting_headers")} WHERE [cycle_setting_id] = @id;
                DELETE FROM {AdminDbContext.QualifiedTableName("cycle_application_settings")} WHERE [id] = @id;
                """,
                command => AddParameter(command, "@id", module),
                ct),
            _ => 0
        };
        return affected > 0;
    }

    private static void AddParameter(DbCommand command, string name, object? value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }

    private async Task EmitAuditAsync(
        string module,
        string action,
        string entityId,
        JsonObject payload,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (module == "audit") return;

        var entityName = AdminRecordJson.StringProp(payload, "name")
            ?? AdminRecordJson.StringProp(payload, "nameAr")
            ?? AdminRecordJson.StringProp(payload, "labelAr")
            ?? entityId;
        await EmitAuditAsync(module, action, entityId, $"{module}.{action} · {entityName}", now, ct);
    }

    private async Task EmitAuditAsync(
        string module,
        string action,
        string entityId,
        string details,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (module == "audit") return;

        var userId = httpContextAccessor.HttpContext?.Request.Headers["X-User-Id"].FirstOrDefault() ?? "system";
        var userName = httpContextAccessor.HttpContext?.Request.Headers["X-User-Name"].FirstOrDefault() ?? "النظام";
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-BE-{Guid.NewGuid():N}",
            module,
            $"{module}.{action}",
            module,
            entityId,
            userId,
            userName,
            details,
            now), ct);
    }

    // ── Portal follow-up exam results (read + merge-write the draft row) ──────
    // The applicant's exam outcomes live in the shared applicant_portal_records
    // draft row, keyed by [type]='draft' AND [record_id] = the identity GUID
    // (same row the applicant API reads when it evaluates the وثيقة التعارف gate).
    private static readonly HashSet<string> FollowUpOutcomes =
        new(StringComparer.OrdinalIgnoreCase) { "pending", "in-progress", "awaiting-approval", "passed", "failed" };

    /// <summary>
    /// Returns the applicant's portal exam outcomes (keyed by the cycle test code,
    /// e.g. TST-01) resolved by GUID / national id / admin record id.
    /// <c>hasPortalRecord</c> is false when no portal draft exists yet; the followUp
    /// object then is empty. Null only when the applicant id itself is unknown.
    /// </summary>
    public async Task<JsonObject?> GetApplicantFollowUpAsync(string id, CancellationToken ct)
    {
        var applicant = await GetNormalizedAsync("applicants", id, ct);
        if (applicant is null) return null;

        var applicantGuid = AdminRecordJson.StringProp(applicant, "applicantTableId");
        if (string.IsNullOrWhiteSpace(applicantGuid))
        {
            return new JsonObject
            {
                ["applicantId"] = null,
                ["hasPortalRecord"] = false,
                ["followUp"] = new JsonObject(),
            };
        }

        var payloadJson = await ReadDraftPayloadAsync(applicantGuid, ct);
        return new JsonObject
        {
            ["applicantId"] = applicantGuid,
            ["hasPortalRecord"] = payloadJson is not null,
            ["followUp"] = ExtractFollowUp(payloadJson),
        };
    }

    /// <summary>
    /// Merges the supplied follow-up outcomes (keyed by cycle test code) into the
    /// applicant's portal draft — the same draft row the applicant API reads when it
    /// evaluates the وثيقة التعارف gate — and returns the refreshed snapshot. Any test
    /// code is accepted; only the outcome value is validated.
    /// </summary>
    public async Task<JsonObject?> UpdateApplicantFollowUpAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var applicant = await GetNormalizedAsync("applicants", id, ct);
        if (applicant is null) return null;

        var applicantGuid = AdminRecordJson.StringProp(applicant, "applicantTableId");
        if (string.IsNullOrWhiteSpace(applicantGuid))
            throw new ConflictException("NO_PORTAL_RECORD", "هذا المتقدم لا يملك ملفاً في بوابة المتقدم");

        var payloadJson = await ReadDraftPayloadAsync(applicantGuid, ct);
        var payload = payloadJson is not null && JsonNode.Parse(payloadJson) is JsonObject existing
            ? existing
            : new JsonObject();
        var followUp = payload["followUp"] as JsonObject ?? new JsonObject();

        var changed = false;
        foreach (var (key, node) in patch)
        {
            if (string.IsNullOrWhiteSpace(key) || node is null) continue;
            string? value;
            try { value = node.GetValue<string>(); }
            catch (InvalidOperationException) { value = node.ToString(); }
            if (string.IsNullOrWhiteSpace(value) || !FollowUpOutcomes.Contains(value)) continue;
            followUp[key] = value;
            changed = true;
        }

        if (!changed)
            throw new ConflictException("NO_VALID_FOLLOW_UP", "لا توجد نتائج اختبارات صالحة للتحديث");

        payload["followUp"] = followUp;
        var now = DateTimeOffset.UtcNow;
        var fullPayload = payload.ToJsonString(AdminRecordJson.Options);

        await ExecuteNormalizedNonQueryAsync(
            $"""
            MERGE {AdminDbContext.QualifiedTableName("applicant_portal_records")} WITH (HOLDLOCK) AS target
            USING (SELECT N'draft' AS [type], @guid AS [record_id]) AS source
                ON target.[type] = source.[type] AND target.[record_id] = source.[record_id]
            WHEN MATCHED THEN
                UPDATE SET [payload_json] = @payload, [updated_at] = @now
            WHEN NOT MATCHED THEN
                INSERT ([type], [record_id], [applicant_id], [payload_json], [created_at], [updated_at])
                VALUES (N'draft', @guid, @guid, @payload, @now, @now);
            """,
            command =>
            {
                AddParameter(command, "@guid", applicantGuid);
                AddParameter(command, "@payload", fullPayload);
                AddParameter(command, "@now", now);
            },
            ct);

        await EmitAuditAsync(
            "applicants",
            "follow_up.update",
            AdminRecordJson.StringProp(applicant, "nationalId") ?? applicantGuid,
            $"applicants.follow_up.update · {AdminRecordJson.StringProp(applicant, "name") ?? applicantGuid}",
            now,
            ct);

        return await GetApplicantFollowUpAsync(id, ct);
    }

    private async Task<string?> ReadDraftPayloadAsync(string applicantGuid, CancellationToken ct)
    {
        var rows = await ExecuteNormalizedQueryAsync(
            $"SELECT TOP (1) [payload_json] FROM {AdminDbContext.QualifiedTableName("applicant_portal_records")} WHERE [type] = N'draft' AND [applicant_id] = @guid",
            command => AddParameter(command, "@guid", applicantGuid),
            reader => new JsonObject
            {
                ["payload_json"] = reader.IsDBNull(0) ? null : JsonValue.Create(reader.GetString(0)),
            },
            ct);
        return rows.Count > 0 ? AdminRecordJson.StringProp(rows[0], "payload_json") : null;
    }

    private static JsonObject ExtractFollowUp(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return new JsonObject();
        try
        {
            if (JsonNode.Parse(payloadJson) is JsonObject payload
                && payload["followUp"] is JsonObject followUp)
            {
                return followUp.DeepClone().AsObject();
            }
        }
        catch (System.Text.Json.JsonException)
        {
            // Malformed draft payload — treat as no recorded outcomes.
        }
        return new JsonObject();
    }
}
