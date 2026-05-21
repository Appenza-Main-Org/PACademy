using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class CategoriesService(IAdmissionsDbContext db)
{
    private static readonly string[] SpecKeys =
    [
        "officers_general",
        "law_bachelor",
        "physical_education_bachelor",
        "specialized_officers"
    ];

    public async Task<IReadOnlyList<JsonObject>> ListAsync(bool includeDeleted, CancellationToken ct)
    {
        var rows = await db.ApplicantCategories.AsNoTracking().OrderBy(x => x.Key).ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<JsonObject?> GetByKeyAsync(string key, CancellationToken ct)
    {
        var row = await db.ApplicantCategories.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> UpdateAsync(string key, JsonObject patch, CancellationToken ct)
    {
        if (!SpecKeys.Contains(key)) throw new EntityNotFoundException("الفئة غير موجودة");
        var entity = await db.ApplicantCategories.FirstOrDefaultAsync(x => x.Key == key, ct)
            ?? throw new EntityNotFoundException("الفئة غير موجودة");

        var obj = ToJson(entity);
        foreach (var item in patch) obj[item.Key] = item.Value?.DeepClone();
        obj["key"] = key;
        entity.LabelAr = AdmissionJson.StringProp(obj, "labelAr") ?? entity.LabelAr;
        entity.IsOpen = AdmissionJson.BoolProp(obj, "isOpen") ?? entity.IsOpen;
        entity.PayloadJson = obj.ToJsonString(AdmissionJson.Options);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public Task<object> DependenciesAsync(string key, CancellationToken ct)
    {
        if (!SpecKeys.Contains(key)) throw new EntityNotFoundException("الفئة غير موجودة");
        return Task.FromResult<object>(new { counts = new { applicants = 0 }, blocking = false });
    }

    public Task<JsonObject> SoftDeleteAsync(string key, CancellationToken ct)
    {
        throw new ConflictException(ErrorCodes.InUse, "فئات المتقدمين مغلقة حسب كراسة الشروط ولا يمكن إنشاء أو حذف فئات");
    }

    private static JsonObject ToJson(ApplicantCategoryEntity entity)
    {
        var obj = AdmissionJson.Parse(entity.PayloadJson);
        obj["key"] = entity.Key;
        obj["labelAr"] = entity.LabelAr;
        obj["isOpen"] = entity.IsOpen;
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }
}
