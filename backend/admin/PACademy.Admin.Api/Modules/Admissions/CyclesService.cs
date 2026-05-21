using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class CyclesService(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<JsonObject>> ListAsync(bool includeDeleted, CancellationToken ct)
    {
        var rows = await db.AdmissionCycles.AsNoTracking().OrderByDescending(x => x.Year).ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<JsonObject?> GetActiveAsync(CancellationToken ct)
    {
        var row = await db.AdmissionCycles.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject?> GetByIdAsync(string id, CancellationToken ct)
    {
        var row = await db.AdmissionCycles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> CreateAsync(JsonObject input, CancellationToken ct)
    {
        var obj = AdmissionJson.Clone(input);
        var id = AdmissionJson.StringProp(obj, "id") ?? $"CYC-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        obj["id"] = id;
        obj["status"] = AdmissionJson.StringProp(obj, "status") ?? "draft";
        if (AdmissionJson.BoolProp(obj, "isActive") == true)
            await EnsureNoOtherActiveAsync(null, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new AdmissionCycleEntity
        {
            Id = id,
            NameAr = AdmissionJson.StringProp(obj, "nameAr") ?? "دورة جديدة",
            Year = AdmissionJson.IntProp(obj, "year") ?? DateTimeOffset.UtcNow.Year,
            Status = AdmissionJson.StringProp(obj, "status") ?? "draft",
            IsActive = AdmissionJson.BoolProp(obj, "isActive") ?? false,
            PayloadJson = obj.ToJsonString(AdmissionJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.AdmissionCycles.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> UpdateAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        var obj = ToJson(entity);
        foreach (var item in patch) obj[item.Key] = item.Value?.DeepClone();
        if (AdmissionJson.BoolProp(obj, "isActive") == true)
            await EnsureNoOtherActiveAsync(id, ct);
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> ActivateAsync(string id, bool swap, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        if (!swap) await EnsureNoOtherActiveAsync(id, ct);

        if (swap)
        {
            var others = await db.AdmissionCycles.Where(x => x.Id != id && x.IsActive).ToListAsync(ct);
            foreach (var other in others)
            {
                var otherJson = ToJson(other);
                otherJson["isActive"] = false;
                otherJson["status"] = "closed";
                Apply(other, otherJson);
            }
        }

        var obj = ToJson(entity);
        obj["isActive"] = true;
        obj["status"] = "active";
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> TransitionAsync(string id, string status, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        var obj = ToJson(entity);
        obj["status"] = status;
        if (status is "closed" or "archived") obj["isActive"] = false;
        if (status is "active" or "open") await EnsureNoOtherActiveAsync(id, ct);
        if (status is "active" or "open") obj["isActive"] = true;
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> UpdateCategoryAsync(string id, string key, JsonObject patch, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        var obj = ToJson(entity);
        var openCategories = obj["openCategories"] as JsonObject ?? [];
        var current = openCategories[key] as JsonObject ?? [];
        foreach (var item in patch) current[item.Key] = item.Value?.DeepClone();
        openCategories[key] = current;
        obj["openCategories"] = openCategories;
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    private async Task<AdmissionCycleEntity> FindAsync(string id, CancellationToken ct)
    {
        return await db.AdmissionCycles.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("دورة القبول غير موجودة");
    }

    private async Task EnsureNoOtherActiveAsync(string? currentId, CancellationToken ct)
    {
        var exists = await db.AdmissionCycles.AnyAsync(x => x.IsActive && x.Id != currentId, ct);
        if (exists)
            throw new ConflictException(ErrorCodes.ActiveCycleExists, "توجد دورة قبول نشطة بالفعل");
    }

    private static void Apply(AdmissionCycleEntity entity, JsonObject obj)
    {
        entity.NameAr = AdmissionJson.StringProp(obj, "nameAr") ?? entity.NameAr;
        entity.Year = AdmissionJson.IntProp(obj, "year") ?? entity.Year;
        entity.Status = AdmissionJson.StringProp(obj, "status") ?? entity.Status;
        entity.IsActive = AdmissionJson.BoolProp(obj, "isActive") ?? entity.IsActive;
        entity.PayloadJson = obj.ToJsonString(AdmissionJson.Options);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static JsonObject ToJson(AdmissionCycleEntity entity)
    {
        var obj = AdmissionJson.Parse(entity.PayloadJson);
        obj["id"] = entity.Id;
        obj["nameAr"] = entity.NameAr;
        obj["year"] = entity.Year;
        obj["status"] = entity.Status;
        obj["isActive"] = entity.IsActive;
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }
}
