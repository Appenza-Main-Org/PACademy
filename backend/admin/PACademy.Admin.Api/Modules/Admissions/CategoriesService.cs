using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class CategoriesService(IAdmissionsDbContext db, IAuditSink auditSink)
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
        await EmitAuditAsync("update", key, $"تحديث فئة قبول · {entity.LabelAr}", ct);
        return ToJson(entity);
    }

    public async Task<object> DependenciesAsync(string key, CancellationToken ct)
    {
        if (!SpecKeys.Contains(key)) throw new EntityNotFoundException("الفئة غير موجودة");
        var applicants = await ApplicantsForCategoryAsync(key, ct);
        var examPlans = await RecordsForCategoryAsync("examPlans", key, ct);
        var committeeBindings = await RecordsForCategoryAsync("committeeBindings", key, ct)
            + await RecordsForCategoryAsync("committeeInstances", key, ct);
        return new
        {
            counts = new { applicants = applicants.Count, examPlans, committeeBindings },
            blocking = applicants.Count > 0 || examPlans > 0 || committeeBindings > 0
        };
    }

    public async Task<object> PreviewRuleChangeAsync(string key, JsonObject? patch, CancellationToken ct)
    {
        if (!SpecKeys.Contains(key)) throw new EntityNotFoundException("الفئة غير موجودة");
        var applicants = await ApplicantsForCategoryAsync(key, ct);
        var impacted = applicants
            .Take(100)
            .Select(applicant => new
            {
                id = StringProp(applicant, "id"),
                name = StringProp(applicant, "name"),
                nationalId = StringProp(applicant, "nationalId"),
                status = StringProp(applicant, "status"),
                reason = "سيتأثر بتعديل شروط الفئة"
            })
            .ToList();
        var conflicts = applicants
            .Where(applicant => StringProp(applicant, "status") is "approved" or "awaiting_board_decision")
            .Take(50)
            .Select(applicant => new
            {
                applicantId = StringProp(applicant, "id"),
                code = "APPLICANT_ALREADY_ADVANCED",
                message = "المتقدم تجاوز مراحل أولية وقد يحتاج مراجعة يدوية"
            })
            .ToList();
        return new { impactedApplicants = impacted, conflicts, proposed = patch ?? [] };
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

    private async Task<IReadOnlyList<JsonObject>> ApplicantsForCategoryAsync(string key, CancellationToken ct)
    {
        var rows = await db.AdminRecords.AsNoTracking().Where(x => x.Module == "applicants").ToListAsync(ct);
        return rows
            .Select(x => AdminRecordJson.Parse(x.PayloadJson))
            .Where(applicant => ResolveCategoryKey(applicant) == key)
            .ToList();
    }

    private async Task<int> RecordsForCategoryAsync(string module, string key, CancellationToken ct)
    {
        var rows = await db.AdminRecords.AsNoTracking().Where(x => x.Module == module).ToListAsync(ct);
        return rows.Select(x => AdminRecordJson.Parse(x.PayloadJson)).Count(row =>
            StringProp(row, "categoryKey") == key ||
            StringProp(row, "categoryId") == key ||
            StringProp(row, "applicantCategory") == key);
    }

    private static string ResolveCategoryKey(JsonObject applicant)
    {
        var explicitKey = StringProp(applicant, "categoryKey")
            ?? StringProp(applicant, "categoryId")
            ?? StringProp(applicant, "applicantCategory");
        if (!string.IsNullOrWhiteSpace(explicitKey)) return explicitKey;

        var certType = StringProp(applicant, "certType") ?? "";
        var certSection = StringProp(applicant, "certSection") ?? "";
        if (certType.Contains("حقوق", StringComparison.OrdinalIgnoreCase)) return "law_bachelor";
        if (certType.Contains("تربية رياضية", StringComparison.OrdinalIgnoreCase)) return "physical_education_bachelor";
        if (certType.Contains("كلية", StringComparison.OrdinalIgnoreCase) || certSection.Contains("جامعة", StringComparison.OrdinalIgnoreCase)) return "specialized_officers";
        return "officers_general";
    }

    private async Task EmitAuditAsync(string action, string entityId, string details, CancellationToken ct)
    {
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-CATEGORIES-{Guid.NewGuid():N}",
            "admissions",
            action,
            "categories",
            entityId,
            "system",
            "النظام",
            details,
            DateTimeOffset.UtcNow), ct);
    }

    private static string? StringProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;
}
