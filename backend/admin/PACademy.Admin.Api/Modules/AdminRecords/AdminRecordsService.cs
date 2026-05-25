using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsService(
    IAdminRecordsDbContext db,
    IHttpContextAccessor httpContextAccessor,
    IAuditSink auditSink)
{
    private const int DefaultBulkBatchSize = 5000;

    public async Task<IReadOnlyList<JsonObject>> ListAsync(string module, CancellationToken ct)
    {
        var rows = await db.AdminRecords.AsNoTracking().Where(x => x.Module == module).OrderBy(x => x.Id).ToListAsync(ct);
        return rows.Select(ToJson).ToList();
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
        var total = rows.Count;
        var data = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return new { data, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) };
    }

    public async Task<JsonObject?> GetAsync(string module, string id, CancellationToken ct)
    {
        var row = await db.AdminRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Module == module && x.Id == id, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> UpsertAsync(string module, string id, JsonObject payload, CancellationToken ct)
    {
        var row = await db.AdminRecords.FirstOrDefaultAsync(x => x.Module == module && x.Id == id, ct);
        var now = DateTimeOffset.UtcNow;
        var isCreate = row is null;
        if (row is null)
        {
            payload["id"] ??= id;
            row = new AdminRecordEntity
            {
                Module = module,
                Id = id,
                PayloadJson = payload.ToJsonString(AdminRecordJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            };
            db.AdminRecords.Add(row);
        }
        else
        {
            var current = ToJson(row);
            foreach (var item in payload) current[item.Key] = item.Value?.DeepClone();
            row.PayloadJson = current.ToJsonString(AdminRecordJson.Options);
            row.UpdatedAt = now;
        }
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync(module, isCreate ? "create" : "update", id, payload, now, ct);
        return ToJson(row);
    }

    public async Task<(HashSet<string> Nids, int NextSeat)> GradesImportIndexAsync(CancellationToken ct)
    {
        var nids = new HashSet<string>(StringComparer.Ordinal);
        var maxSeat = 0;

        await foreach (var payloadJson in db.AdminRecords
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
                var entities = new List<AdminRecordEntity>(count);
                for (var i = offset; i < offset + count; i++)
                {
                    var payload = payloads[i];
                    var id = AdminRecordJson.StringProp(payload, "id")
                        ?? throw new InvalidOperationException("Bulk admin record payload is missing id.");
                    entities.Add(new AdminRecordEntity
                    {
                        Module = module,
                        Id = id,
                        PayloadJson = payload.ToJsonString(AdminRecordJson.Options),
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                }

                db.AdminRecords.AddRange(entities);
                inserted += await db.SaveChangesAsync(ct);
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
        var row = await db.AdminRecords.FirstOrDefaultAsync(x => x.Module == module && x.Id == id, ct);
        if (row is null) return false;
        var payload = ToJson(row);
        db.AdminRecords.Remove(row);
        var now = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync(module, "delete", id, payload, now, ct);
        return true;
    }

    public async Task<int> DeleteModuleAsync(string module, CancellationToken ct)
    {
        var deleted = await db.AdminRecords
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
            var rows = await db.AdminRecords
                .Where(x => x.Module == module)
                .OrderBy(x => x.Id)
                .Take(DefaultBulkBatchSize)
                .ToListAsync(ct);
            if (rows.Count == 0) break;

            db.AdminRecords.RemoveRange(rows);
            deleted += await db.SaveChangesAsync(ct);
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
        var deleted = await db.AdminRecords
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
            var rows = await db.AdminRecords
                .Where(x => x.Module == module && batchIds.Contains(x.Id))
                .ToListAsync(ct);
            if (rows.Count == 0)
            {
                foreach (var id in batchIds) idSet.Remove(id);
                continue;
            }

            db.AdminRecords.RemoveRange(rows);
            deleted += await db.SaveChangesAsync(ct);
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
        var idSet = ids.ToHashSet(StringComparer.Ordinal);
        var deleted = 0;

        while (idSet.Count > 0)
        {
            var batchIds = idSet.Take(DefaultBulkBatchSize).ToArray();
            var rows = await db.AdminRecords
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

            if (batchModified > 0) await db.SaveChangesAsync(ct);
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
        var deleted = 0;
        var now = DateTimeOffset.UtcNow;
        var nowIso = now.ToString("O");
        var offset = 0;
        while (true)
        {
            var rows = await db.AdminRecords
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
            if (batchModified > 0) await db.SaveChangesAsync(ct);
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
        var rows = await db.AdminRecords
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
        if (removed > 0) await db.SaveChangesAsync(ct);
        return removed;
    }

    public async Task<JsonObject> SingletonAsync(string module, JsonObject fallback, CancellationToken ct)
    {
        var row = await db.AdminRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Module == module && x.Id == module, ct);
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
