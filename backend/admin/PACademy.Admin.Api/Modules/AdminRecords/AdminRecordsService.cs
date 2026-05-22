using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordsService(IAdminRecordsDbContext db, IHttpContextAccessor httpContextAccessor)
{
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

    public async Task<bool> DeleteAsync(string module, string id, CancellationToken ct)
    {
        var row = await db.AdminRecords.FirstOrDefaultAsync(x => x.Module == module && x.Id == id, ct);
        if (row is null) return false;
        db.AdminRecords.Remove(row);
        AddAuditRecord(module, "delete", id, ToJson(row), DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(ct);
        return true;
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
}
