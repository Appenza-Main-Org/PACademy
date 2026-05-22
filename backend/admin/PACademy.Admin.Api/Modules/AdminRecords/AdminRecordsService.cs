using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsService(IAdminRecordsDbContext db, IHttpContextAccessor httpContextAccessor)
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
        AddAuditRecord(module, isCreate ? "create" : "update", id, payload, now);
        await db.SaveChangesAsync(ct);
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
            var nid = AdminRecordJson.StringProp(payload, "nid");
            if (!string.IsNullOrWhiteSpace(nid)) nids.Add(nid);
            maxSeat = Math.Max(maxSeat, (int)(AdminRecordJson.NumberProp(payload, "seat") ?? 0));
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
        AddAuditSummaryRecord(module, action, entityId, details, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteAsync(string module, string id, CancellationToken ct)
    {
        var row = await db.AdminRecords.FirstOrDefaultAsync(x => x.Module == module && x.Id == id, ct);
        if (row is null) return false;
        db.AdminRecords.Remove(row);
        AddAuditRecord(module, "delete", id, ToJson(row), DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(ct);
        return true;
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

    private void AddAuditRecord(string module, string action, string entityId, JsonObject payload, DateTimeOffset now)
    {
        if (module == "audit") return;

        var userId = httpContextAccessor.HttpContext?.Request.Headers["X-User-Id"].FirstOrDefault() ?? "system";
        var userName = httpContextAccessor.HttpContext?.Request.Headers["X-User-Name"].FirstOrDefault() ?? "النظام";
        var ip = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "local";
        var auditId = $"AUD-BE-{now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..39];
        var entityName = AdminRecordJson.StringProp(payload, "name")
            ?? AdminRecordJson.StringProp(payload, "nameAr")
            ?? AdminRecordJson.StringProp(payload, "labelAr")
            ?? entityId;
        var audit = new JsonObject
        {
            ["id"] = auditId,
            ["userId"] = userId,
            ["userName"] = userName,
            ["role"] = httpContextAccessor.HttpContext?.Request.Headers["X-User-Role"].FirstOrDefault() ?? "system",
            ["module"] = module,
            ["action"] = $"{module}.{action}",
            ["actionLabel"] = action switch
            {
                "create" => "إنشاء سجل",
                "update" => "تحديث سجل",
                "delete" => "حذف سجل",
                _ => "تعديل سجل"
            },
            ["actionColor"] = action == "delete" ? "danger" : action == "create" ? "success" : "info",
            ["entity"] = module,
            ["entityType"] = module,
            ["entityId"] = entityId,
            ["details"] = $"{module}.{action} · {entityName}",
            ["timestamp"] = now.ToUnixTimeMilliseconds(),
            ["ip"] = ip
        };
        db.AdminRecords.Add(new AdminRecordEntity
        {
            Module = "audit",
            Id = auditId,
            PayloadJson = audit.ToJsonString(AdminRecordJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private void AddAuditSummaryRecord(string module, string action, string entityId, string details, DateTimeOffset now)
    {
        if (module == "audit") return;

        var userId = httpContextAccessor.HttpContext?.Request.Headers["X-User-Id"].FirstOrDefault() ?? "system";
        var userName = httpContextAccessor.HttpContext?.Request.Headers["X-User-Name"].FirstOrDefault() ?? "النظام";
        var ip = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "local";
        var auditId = $"AUD-BE-{now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..39];
        var audit = new JsonObject
        {
            ["id"] = auditId,
            ["userId"] = userId,
            ["userName"] = userName,
            ["role"] = httpContextAccessor.HttpContext?.Request.Headers["X-User-Role"].FirstOrDefault() ?? "system",
            ["module"] = module,
            ["action"] = $"{module}.{action}",
            ["actionLabel"] = "استيراد جماعي",
            ["actionColor"] = "success",
            ["entity"] = module,
            ["entityType"] = module,
            ["entityId"] = entityId,
            ["details"] = details,
            ["timestamp"] = now.ToUnixTimeMilliseconds(),
            ["ip"] = ip
        };
        db.AdminRecords.Add(new AdminRecordEntity
        {
            Module = "audit",
            Id = auditId,
            PayloadJson = audit.ToJsonString(AdminRecordJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        });
    }
}
