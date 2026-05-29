using System.Text.Json.Nodes;
using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsService(
    IAdminRecordsDbContext db,
    IHttpContextAccessor httpContextAccessor,
    IAuditSink auditSink,
    IAdminRecordDocumentsDbContext? documentsDb = null)
{
    private const int DefaultBulkBatchSize = 5000;

    private IAdminRecordDocumentsDbContext DocumentsDb =>
        documentsDb ?? (db as IAdminRecordDocumentsDbContext)
        ?? throw new InvalidOperationException("Admin record document store is not registered.");

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
        var existing = await GetDocumentEntityAsync(module, id, tracking: true, ct);
        var isCreate = existing is null;
        var next = payload.DeepClone().AsObject();
        next["id"] ??= id;
        if (existing is null)
        {
            DocumentsDb.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
            {
                Module = module,
                Id = id,
                PayloadJson = next.ToJsonString(AdminRecordJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            var current = ToJson(existing);
            foreach (var item in payload) current[item.Key] = item.Value?.DeepClone();
            existing.PayloadJson = current.ToJsonString(AdminRecordJson.Options);
            existing.UpdatedAt = now;
            next = current;
        }
        await DocumentsDb.SaveChangesAsync(ct);
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

        await foreach (var payloadJson in DocumentsDb.AdminRecordDocuments
            .AsNoTracking()
            .Where(x => x.Module == "grades")
            .Select(x => x.PayloadJson)
            .AsAsyncEnumerable()
            .WithCancellation(ct))
        {
            var payload = AdminRecordJson.Parse(payloadJson);
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

        var context = db as DbContext;
        var previousAutoDetectChanges = context?.ChangeTracker.AutoDetectChangesEnabled;
        if (context is not null) context.ChangeTracker.AutoDetectChangesEnabled = false;

        try
        {
            var now = DateTimeOffset.UtcNow;
            var inserted = 0;

            for (var offset = 0; offset < payloads.Count; offset += batchSize)
            {
                var count = Math.Min(batchSize, payloads.Count - offset);
                for (var i = offset; i < offset + count; i++)
                {
                    var payload = payloads[i];
                    var id = AdminRecordJson.StringProp(payload, "id")
                        ?? throw new InvalidOperationException("Bulk admin record payload is missing id.");
                    DocumentsDb.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
                    {
                        Module = module,
                        Id = id,
                        PayloadJson = payload.ToJsonString(AdminRecordJson.Options),
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                }

                inserted += await DocumentsDb.SaveChangesAsync(ct);
                context?.ChangeTracker.Clear();
            }

            return inserted;
        }
        finally
        {
            if (context is not null && previousAutoDetectChanges is not null)
            {
                context.ChangeTracker.AutoDetectChangesEnabled = previousAutoDetectChanges.Value;
            }
        }
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

        var row = await GetDocumentEntityAsync(module, id, tracking: true, ct);
        if (row is null) return false;
        var payload = ToJson(row);
        DocumentsDb.AdminRecordDocuments.Remove(row);
        var now = DateTimeOffset.UtcNow;
        await DocumentsDb.SaveChangesAsync(ct);
        await EmitAuditAsync(module, "delete", id, payload, now, ct);
        return true;
    }

    public async Task<int> DeleteModuleAsync(string module, CancellationToken ct)
    {
        var deleted = await DocumentsDb.AdminRecordDocuments
            .Where(x => x.Module == module)
            .ExecuteDeleteAsync(ct);
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
        var deleted = 0;
        while (true)
        {
            var rows = await DocumentsDb.AdminRecordDocuments
                .Where(x => x.Module == module)
                .OrderBy(x => x.Id)
                .Take(DefaultBulkBatchSize)
                .ToListAsync(ct);
            if (rows.Count == 0) break;

            DocumentsDb.AdminRecordDocuments.RemoveRange(rows);
            deleted += await DocumentsDb.SaveChangesAsync(ct);
        }

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
        var deleted = await DocumentsDb.AdminRecordDocuments
            .Where(x => x.Module == module && ids.Contains(x.Id))
            .ExecuteDeleteAsync(ct);
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
        if (ids.Count == 0) return 0;
        var idSet = ids.ToHashSet(StringComparer.Ordinal);
        var deleted = 0;

        while (idSet.Count > 0)
        {
            var batchIds = idSet.Take(DefaultBulkBatchSize).ToArray();
            var rows = await DocumentsDb.AdminRecordDocuments
                .Where(x => x.Module == module && batchIds.Contains(x.Id))
                .ToListAsync(ct);
            if (rows.Count == 0)
            {
                foreach (var id in batchIds) idSet.Remove(id);
                continue;
            }

            DocumentsDb.AdminRecordDocuments.RemoveRange(rows);
            deleted += await DocumentsDb.SaveChangesAsync(ct);
            foreach (var row in rows) idSet.Remove(row.Id);
        }

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

        var idSet = ids.ToHashSet(StringComparer.Ordinal);
        var deleted = 0;

        while (idSet.Count > 0)
        {
            var batchIds = idSet.Take(DefaultBulkBatchSize).ToArray();
            var rows = await DocumentsDb.AdminRecordDocuments
                .Where(x => x.Module == module && batchIds.Contains(x.Id))
                .ToListAsync(ct);
            if (rows.Count == 0)
            {
                foreach (var id in batchIds) idSet.Remove(id);
                continue;
            }

            var now = DateTimeOffset.UtcNow;
            var batchModified = 0;
            foreach (var row in rows)
            {
                var payload = AdminRecordJson.Parse(row.PayloadJson);
                if (AdminRecordJson.IsSoftDeleted(payload))
                {
                    idSet.Remove(row.Id);
                    continue;
                }
                payload["deletedAt"] = now.ToString("O");
                payload["deletedBy"] = deletedBy ?? "system";
                if (!string.IsNullOrWhiteSpace(reason)) payload["deleteReason"] = reason;
                row.PayloadJson = payload.ToJsonString(AdminRecordJson.Options);
                row.UpdatedAt = now;
                deleted++;
                batchModified++;
                idSet.Remove(row.Id);
            }
            // Also drop any batch ids whose rows weren't found (and thus weren't in `rows`).
            foreach (var id in batchIds) idSet.Remove(id);

            if (batchModified > 0) await DocumentsDb.SaveChangesAsync(ct);
        }

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

        var deleted = 0;
        var now = DateTimeOffset.UtcNow;
        var nowIso = now.ToString("O");
        var offset = 0;
        while (true)
        {
            var rows = await DocumentsDb.AdminRecordDocuments
                .Where(x => x.Module == module)
                .OrderBy(x => x.Id)
                .Skip(offset)
                .Take(DefaultBulkBatchSize)
                .ToListAsync(ct);
            if (rows.Count == 0) break;
            offset += rows.Count;
            var batchModified = 0;
            foreach (var row in rows)
            {
                var payload = AdminRecordJson.Parse(row.PayloadJson);
                if (AdminRecordJson.IsSoftDeleted(payload)) continue;
                payload["deletedAt"] = nowIso;
                payload["deletedBy"] = deletedBy ?? "system";
                if (!string.IsNullOrWhiteSpace(reason)) payload["deleteReason"] = reason;
                row.PayloadJson = payload.ToJsonString(AdminRecordJson.Options);
                row.UpdatedAt = now;
                deleted++;
                batchModified++;
            }
            if (batchModified > 0) await DocumentsDb.SaveChangesAsync(ct);
        }

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
        var rows = await DocumentsDb.AdminRecordDocuments
            .Where(x => x.Module.StartsWith(modulePrefix))
            .ToListAsync(ct);
        var removed = 0;
        foreach (var row in rows)
        {
            var payload = ToJson(row);
            if (payload[arrayName] is not JsonArray array) continue;
            var kept = new JsonArray();
            var rowRemoved = 0;
            foreach (var item in array.OfType<JsonObject>())
            {
                if (AdminRecordJson.StringProp(item, "id") == id)
                {
                    rowRemoved++;
                    continue;
                }
                kept.Add(item.DeepClone());
            }
            if (rowRemoved == 0) continue;
            removed += rowRemoved;
            payload[arrayName] = kept;
            row.PayloadJson = payload.ToJsonString(AdminRecordJson.Options);
            row.UpdatedAt = DateTimeOffset.UtcNow;
        }
        if (removed > 0) await DocumentsDb.SaveChangesAsync(ct);
        return removed;
    }

    public async Task<JsonObject> SingletonAsync(string module, JsonObject fallback, CancellationToken ct)
    {
        var row = await GetDocumentEntityAsync(module, module, tracking: false, ct);
        return row is null ? fallback : ToJson(row);
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

    private static JsonObject ToJson(AdminRecordEntity entity)
    {
        var obj = AdminRecordJson.Parse(entity.PayloadJson);
        obj["id"] ??= entity.Id;
        obj["createdAt"] ??= entity.CreatedAt;
        obj["updatedAt"] ??= entity.UpdatedAt;
        return obj;
    }

    private async Task<IReadOnlyList<JsonObject>> ListDocumentAsync(string module, CancellationToken ct)
    {
        await DrainLegacyAdminRecordsAsync(module, ct);
        var rows = await DocumentsDb.AdminRecordDocuments
            .AsNoTracking()
            .Where(x => x.Module == module)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    private async Task<JsonObject?> GetDocumentAsync(string module, string id, CancellationToken ct)
    {
        var row = await GetDocumentEntityAsync(module, id, tracking: false, ct);
        return row is null ? null : ToJson(row);
    }

    private async Task<AdminRecordDocumentEntity?> GetDocumentEntityAsync(
        string module,
        string id,
        bool tracking,
        CancellationToken ct)
    {
        await DrainLegacyAdminRecordsAsync(module, ct);
        var query = DocumentsDb.AdminRecordDocuments.Where(x => x.Module == module && x.Id == id);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct);
    }

    private async Task DrainLegacyAdminRecordsAsync(string module, CancellationToken ct)
    {
        var rows = await db.AdminRecords.Where(x => x.Module == module).ToListAsync(ct);
        if (rows.Count == 0) return;

        foreach (var row in rows)
        {
            var exists = await DocumentsDb.AdminRecordDocuments
                .AnyAsync(x => x.Module == row.Module && x.Id == row.Id, ct);
            if (!exists)
            {
                DocumentsDb.AdminRecordDocuments.Add(new AdminRecordDocumentEntity
                {
                    Module = row.Module,
                    Id = row.Id,
                    PayloadJson = row.PayloadJson,
                    CreatedAt = row.CreatedAt,
                    UpdatedAt = row.UpdatedAt
                });
            }
        }
        db.AdminRecords.RemoveRange(rows);
        await DocumentsDb.SaveChangesAsync(ct);
    }

    private static JsonObject ToJson(AdminRecordDocumentEntity entity)
    {
        var obj = AdminRecordJson.Parse(entity.PayloadJson);
        obj["id"] ??= entity.Id;
        obj["createdAt"] ??= entity.CreatedAt;
        obj["updatedAt"] ??= entity.UpdatedAt;
        return obj;
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
            "settings" => "settings",
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
                SELECT [payload_json], [id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender],
                       [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source],
                       [created_at], [updated_at]
                FROM {AdminDbContext.QualifiedTableName("applicants")}
                ORDER BY [national_id]
                """,
                ct),
            "grades" => await QueryPayloadRowsAsync(
                $"SELECT [payload_json], CONVERT(nvarchar(128), [seat]) AS [row_id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_grades")} ORDER BY [seat]",
                "row_id",
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
                SELECT TOP (1) [payload_json], [id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender],
                       [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source],
                       [created_at], [updated_at]
                FROM {AdminDbContext.QualifiedTableName("applicants")}
                WHERE [admin_record_id] = @id OR [national_id] = @id OR CONVERT(nvarchar(64), [id]) = @id
                """,
                ct,
                command => AddParameter(command, "@id", id)),
            "grades" => await QueryPayloadRowsAsync(
                $"SELECT TOP (1) [payload_json], CONVERT(nvarchar(128), [seat]) AS [row_id], [created_at], [updated_at] FROM {AdminDbContext.QualifiedTableName("applicant_grades")} WHERE CONVERT(nvarchar(128), [seat]) = @id OR [admin_record_id] = @id OR [nid] = @id",
                "row_id",
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
                    MERGE {AdminDbContext.QualifiedTableName("applicants")} WITH (HOLDLOCK) AS target
                    USING (SELECT @nationalId AS [national_id]) AS source
                    ON target.[national_id] COLLATE DATABASE_DEFAULT = source.[national_id] COLLATE DATABASE_DEFAULT
                    WHEN MATCHED THEN UPDATE SET
                        [admin_record_id] = @id,
                        [phone_number] = COALESCE(JSON_VALUE(@payload, '$.phoneNumber'), JSON_VALUE(@payload, '$.phone_number'), JSON_VALUE(@payload, '$.contact.mobilePhone'), [phone_number]),
                        [full_name] = COALESCE(JSON_VALUE(@payload, '$.name'), [full_name]),
                        [email] = COALESCE(JSON_VALUE(@payload, '$.email'), JSON_VALUE(@payload, '$.contact.email'), [email]),
                        [gender] = COALESCE(JSON_VALUE(@payload, '$.gender'), [gender]),
                        [religion] = COALESCE(JSON_VALUE(@payload, '$.religion'), [religion]),
                        [date_of_birth] = COALESCE(TRY_CONVERT(date, JSON_VALUE(@payload, '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(@payload, '$.dateOfBirth')), [date_of_birth]),
                        [birth_governorate] = COALESCE(JSON_VALUE(@payload, '$.birthGovernorate'), JSON_VALUE(@payload, '$.currentAddress.governorate'), JSON_VALUE(@payload, '$.governorate'), [birth_governorate]),
                        [birth_district] = COALESCE(JSON_VALUE(@payload, '$.birthDistrict'), JSON_VALUE(@payload, '$.currentAddress.city'), JSON_VALUE(@payload, '$.city'), [birth_district]),
                        [certificate_type] = COALESCE(JSON_VALUE(@payload, '$.certType'), JSON_VALUE(@payload, '$.education.certificateName'), [certificate_type]),
                        [payload_json] = @payload,
                        [updated_at] = @now
                    WHEN NOT MATCHED THEN INSERT
                        ([id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender], [religion], [date_of_birth], [birth_governorate], [birth_district], [certificate_type], [source], [payload_json], [created_at], [updated_at])
                    VALUES
                        (NEWID(), @id, @nationalId, COALESCE(JSON_VALUE(@payload, '$.phoneNumber'), JSON_VALUE(@payload, '$.phone_number'), JSON_VALUE(@payload, '$.contact.mobilePhone')),
                         JSON_VALUE(@payload, '$.name'), COALESCE(JSON_VALUE(@payload, '$.email'), JSON_VALUE(@payload, '$.contact.email')), JSON_VALUE(@payload, '$.gender'),
                         JSON_VALUE(@payload, '$.religion'), COALESCE(TRY_CONVERT(date, JSON_VALUE(@payload, '$.birthDate')), TRY_CONVERT(date, JSON_VALUE(@payload, '$.dateOfBirth'))),
                         COALESCE(JSON_VALUE(@payload, '$.birthGovernorate'), JSON_VALUE(@payload, '$.currentAddress.governorate'), JSON_VALUE(@payload, '$.governorate')),
                         COALESCE(JSON_VALUE(@payload, '$.birthDistrict'), JSON_VALUE(@payload, '$.currentAddress.city'), JSON_VALUE(@payload, '$.city')),
                         COALESCE(JSON_VALUE(@payload, '$.certType'), JSON_VALUE(@payload, '$.education.certificateName')), N'api', @payload, @now, @now);
                    """, command =>
                {
                    AddParameter(command, "@id", id);
                    AddParameter(command, "@nationalId", nationalId);
                    AddParameter(command, "@payload", payloadJson);
                    AddParameter(command, "@now", now);
                }, ct);
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
            var tableId = reader.GetGuid(1).ToString();
            var adminRecordId = ReadString(reader, 2);
            var nationalId = ReadString(reader, 3);
            var phoneNumber = ReadString(reader, 4);
            var fullName = ReadString(reader, 5);
            var email = ReadString(reader, 6);
            var gender = ReadString(reader, 7);
            var religion = ReadString(reader, 8);
            var birthDate = reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTime>(9).ToString("yyyy-MM-dd");
            var birthGovernorate = ReadString(reader, 10);
            var birthDistrict = ReadString(reader, 11);
            var certificateType = ReadString(reader, 12);
            var source = ReadString(reader, 13);

            payload["applicantTableId"] = tableId;
            if (!string.IsNullOrWhiteSpace(adminRecordId)) payload["adminRecordId"] = adminRecordId;
            payload["id"] ??= adminRecordId ?? tableId;
            SetIfPresent(payload, "nationalId", nationalId);
            SetIfPresent(payload, "phoneNumber", phoneNumber);
            SetIfPresent(payload, "name", fullName);
            SetIfPresent(payload, "email", email);
            SetIfPresent(payload, "gender", gender);
            SetIfPresent(payload, "religion", religion);
            SetIfPresent(payload, "birthDate", birthDate);
            SetIfPresent(payload, "birthGovernorate", birthGovernorate);
            SetIfPresent(payload, "birthDistrict", birthDistrict);
            SetIfPresent(payload, "certType", certificateType);
            SetIfPresent(payload, "source", source);
            payload["createdAt"] ??= reader.GetFieldValue<DateTimeOffset>(14);
            payload["updatedAt"] ??= reader.GetFieldValue<DateTimeOffset>(15);
            return payload;
        }, ct);
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
            payload["birthGovernorate"] ??= info.GovernorateCode;
        }
    }

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
}
