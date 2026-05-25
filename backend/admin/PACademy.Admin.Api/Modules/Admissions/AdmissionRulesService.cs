using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionRulesService(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<JsonObject>> ListForCycleAsync(string cycleId, CancellationToken ct)
    {
        var rows = await db.AdmissionRules
            .AsNoTracking()
            .Where(x => x.CycleId == cycleId)
            .OrderByDescending(x => x.Version)
            .ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<JsonObject?> CurrentAsync(string cycleId, CancellationToken ct)
    {
        var row = await db.AdmissionRules
            .AsNoTracking()
            .Where(x => x.CycleId == cycleId)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> SaveAsync(JsonObject payload, CancellationToken ct)
    {
        var cycleId = AdmissionJson.StringProp(payload, "cycleId") ?? throw new FluentValidation.ValidationException("cycleId مطلوب");
        var maxVersion = await db.AdmissionRules
            .Where(x => x.CycleId == cycleId)
            .Select(x => (int?)x.Version)
            .MaxAsync(ct) ?? 0;
        var version = maxVersion + 1;
        var obj = AdmissionJson.Clone(payload);
        obj["id"] = $"RULE-{cycleId}-V{version}";
        obj["version"] = version;
        obj["effectiveAt"] = AdmissionJson.StringProp(obj, "effectiveAt") ?? DateTimeOffset.UtcNow.ToString("O");
        var now = DateTimeOffset.UtcNow;
        var entity = new AdmissionRuleEntity
        {
            Id = AdmissionJson.StringProp(obj, "id")!,
            CycleId = cycleId,
            Version = version,
            PayloadJson = obj.ToJsonString(AdmissionJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };
        db.AdmissionRules.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    private static JsonObject ToJson(AdmissionRuleEntity entity)
    {
        var obj = AdmissionJson.Parse(entity.PayloadJson);
        obj["id"] = entity.Id;
        obj["cycleId"] = entity.CycleId;
        obj["version"] = entity.Version;
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }
}
