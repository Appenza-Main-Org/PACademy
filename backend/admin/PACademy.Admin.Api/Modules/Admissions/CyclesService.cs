using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class CyclesService(IAdmissionsDbContext db, IAuditSink auditSink)
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
        await EmitAuditAsync("create", id, $"إنشاء دورة قبول · {entity.NameAr}", ct);
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
        await EmitAuditAsync("update", id, $"تحديث دورة قبول · {entity.NameAr}", ct);
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
        await EmitAuditAsync("activate", id, $"تفعيل دورة قبول · {entity.NameAr}", ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> DeactivateAsync(string id, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        var obj = ToJson(entity);
        obj["isActive"] = false;
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("deactivate", id, $"إلغاء تفعيل دورة قبول · {entity.NameAr}", ct);
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
        await EmitAuditAsync("transition", id, $"تغيير حالة دورة قبول إلى {status} · {entity.NameAr}", ct);
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
        await EmitAuditAsync("update_category", id, $"تحديث فئة {key} داخل دورة {entity.NameAr}", ct);
        return ToJson(entity);
    }

    public async Task<object> DependenciesAsync(string id, CancellationToken ct)
    {
        var cycle = await FindAsync(id, ct);
        var cycleJson = ToJson(cycle);
        var year = AdmissionJson.IntProp(cycleJson, "year") ?? cycle.Year;
        var applicants = await CountApplicantsForCycleAsync(id, year, ct);
        var committees = await CountRecordsForCycleAsync("committeeInstances", id, ct)
            + await CountRecordsForCycleAsync("committees", id, ct);
        var examPlans = await CountRecordsForCycleAsync("examPlans", id, ct);
        var workflows = await CountRecordsForCycleAsync("workflows", id, ct);
        return new
        {
            counts = new { applicants, committees, examPlans, workflows },
            blocking = applicants > 0 || committees > 0 || examPlans > 0 || workflows > 0
        };
    }

    public async Task<object> DeleteAsync(string id, CancellationToken ct)
    {
        var entity = await FindAsync(id, ct);
        if (entity.IsActive)
        {
            throw new ConflictException(ErrorCodes.InUse, "لا يمكن حذف الدورة النشطة");
        }

        var dependencies = await DependenciesAsync(id, ct);
        if (IsBlocking(dependencies)) throw new ConflictException(ErrorCodes.InUse, "لا يمكن حذف دورة مرتبطة بسجلات تشغيلية");
        db.AdmissionCycles.Remove(entity);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("delete", id, $"حذف دورة قبول · {entity.NameAr}", ct);
        return new { deleted = true, id };
    }

    public async Task<object> SoftDeleteAsync(string id, CancellationToken ct)
    {
        var dependencies = await DependenciesAsync(id, ct);
        if (IsBlocking(dependencies)) throw new ConflictException(ErrorCodes.InUse, "لا يمكن أرشفة دورة مرتبطة بسجلات تشغيلية");
        var entity = await FindAsync(id, ct);
        var obj = ToJson(entity);
        obj["deletedAt"] = DateTimeOffset.UtcNow.ToString("O");
        obj["deletedBy"] = "system";
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("soft_delete", id, $"أرشفة دورة قبول · {entity.NameAr}", ct);
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

    private async Task<int> CountApplicantsForCycleAsync(string cycleId, int year, CancellationToken ct)
    {
        var rows = await db.AdminRecords.AsNoTracking().Where(x => x.Module == "applicants").ToListAsync(ct);
        return rows.Select(x => AdminRecordJson.Parse(x.PayloadJson)).Count(applicant =>
            StringProp(applicant, "cycleId") == cycleId ||
            StringProp(applicant, "admissionCycleId") == cycleId ||
            RegisteredYear(applicant) == year);
    }

    private async Task<int> CountRecordsForCycleAsync(string module, string cycleId, CancellationToken ct)
    {
        var rows = await db.AdminRecords.AsNoTracking().Where(x => x.Module == module).ToListAsync(ct);
        return rows.Select(x => AdminRecordJson.Parse(x.PayloadJson)).Count(row =>
            StringProp(row, "cycleId") == cycleId ||
            StringProp(row, "admissionCycleId") == cycleId);
    }

    private static int? RegisteredYear(JsonObject applicant)
    {
        var registeredAt = StringProp(applicant, "registeredAt");
        return DateTimeOffset.TryParse(registeredAt, out var parsed) ? parsed.Year : null;
    }

    private static bool IsBlocking(object dependencies)
    {
        var blocking = dependencies.GetType().GetProperty("blocking")?.GetValue(dependencies);
        return blocking is true;
    }

    private async Task EmitAuditAsync(string action, string entityId, string details, CancellationToken ct)
    {
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-CYCLES-{Guid.NewGuid():N}",
            "admissions",
            action,
            "cycles",
            entityId,
            "system",
            "النظام",
            details,
            DateTimeOffset.UtcNow), ct);
    }

    private static string? StringProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;

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
