using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

public sealed class ApplicantEligibilityService(AdminDbContext db, AdminRecordsService records)
{
    public async Task<ApplicantEligibilityResponse> GetEligibleCategoriesAsync(string nationalId, CancellationToken ct)
    {
        var nid = NationalIdParser.ParseEgyptianNationalId(nationalId);
        var activeCycle = await db.AdmissionCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IsActive, ct)
            ?? throw new EntityNotFoundException("لا توجد دورة قبول نشطة");

        var configs = await db.ApplicationSettingsCategoryConfigs
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        var configIds = configs.Select(x => x.Id).ToArray();
        var specs = await db.ApplicationSettingsCategorySpecializations
            .AsNoTracking()
            .Where(x => x.IsActive && configIds.Contains(x.ConfigId))
            .ToListAsync(ct);
        var specIds = specs.Select(x => x.Id).ToArray();
        var years = await db.ApplicationSettingsGraduationYears
            .AsNoTracking()
            .Where(x => x.IsActive && specIds.Contains(x.CategorySpecializationId))
            .ToListAsync(ct);

        var lookupRows = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.IsActive && (x.LookupKey == "applicant-categories" || x.LookupKey == "school-categories"))
            .ToListAsync(ct);
        var categoryLookups = lookupRows
            .Where(x => x.LookupKey == "applicant-categories")
            .Select(LookupToJson)
            .ToDictionary(x => EligibilityJson.StringProp(x, "code") ?? "", StringComparer.OrdinalIgnoreCase);
        var lookups = new EligibilityLookupSnapshot(
            lookupRows.Where(x => x.LookupKey == "school-categories").Select(LookupToJson).ToArray());

        var grade = await LoadGradeAsync(nid.NationalId, ct);
        var firstReferenceDate = years.Select(x => (DateOnly?)x.AgeReferenceDate).OrderBy(x => x).FirstOrDefault()
            ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var applicant = BuildApplicantContext(nid, grade, firstReferenceDate);

        var results = new List<CategoryEligibilityResult>();
        foreach (var config in configs)
        {
            var categoryRules = years
                .Where(year => specs.Any(spec => spec.ConfigId == config.Id && spec.Id == year.CategorySpecializationId))
                .ToArray();
            categoryLookups.TryGetValue(config.CategoryId, out var categoryLookup);
            categoryLookup ??= new JsonObject { ["code"] = config.CategoryId, ["name"] = config.CategoryId };
            var settings = new CategoryEligibilitySettings(
                config.CategoryId,
                EligibilityJson.StringProp(categoryLookup, "name") ?? config.CategoryId,
                categoryLookup,
                categoryRules,
                lookups.SchoolCategories);

            var age = (AgeCheckResult)EligibilityCheckRegistry.Checks["ageCheck"](applicant, settings, lookups);
            var gender = (GenderCheckResult)EligibilityCheckRegistry.Checks["genderCheck"](applicant, settings, lookups);
            var stage = (StageCheckResult)EligibilityCheckRegistry.Checks["stageCheck"](applicant, settings, lookups);
            var grades = (GradesCheckResult)EligibilityCheckRegistry.Checks["gradesCheck"](applicant, settings, lookups);
            var checks = new EligibilityChecks(age, gender, stage, grades);
            var failedReasons = BuildFailedReasons(checks, settings);
            results.Add(new CategoryEligibilityResult(
                settings.CategoryId,
                settings.CategoryName,
                failedReasons.Count == 0,
                checks,
                failedReasons));
        }

        return new ApplicantEligibilityResponse(
            nid.NationalId,
            new ApplicantDerivedEligibility(
                nid.BirthDate,
                applicant.Age,
                nid.GenderAr,
                nid.GovernorateCode),
            activeCycle.Id,
            results);
    }

    private async Task<JsonObject?> LoadGradeAsync(string nationalId, CancellationToken ct)
    {
        return (await records.ListAsync("grades", ct))
            .FirstOrDefault(x =>
                !AdminRecordJson.IsSoftDeleted(x) &&
                string.Equals(AdminRecordJson.StringProp(x, "nid") ?? AdminRecordJson.StringProp(x, "nationalId"), nationalId, StringComparison.Ordinal));
    }

    private static ApplicantEligibilityContext BuildApplicantContext(
        EgyptianNationalIdInfo nid,
        JsonObject? grade,
        DateOnly referenceDate)
    {
        var schoolCategoryCode = EligibilityJson.FirstString(grade, "schoolCategoryCode", "schoolCategory");
        var schoolCategory = EligibilityJson.FirstString(grade, "schoolCategoryName", "schoolCategory", "certificateTypeName", "kind");
        var certificateType = EligibilityJson.FirstString(grade, "certificateType", "certificateTypeName", "kind", "schoolCategory");
        var gradeSource = EligibilityJson.FirstString(grade, "gradesSource", "source", "مصدر الدرجات");
        var stage = EligibilityJson.FirstString(grade, "stage", "requiredStage", "gradeKind", "kind");
        return new ApplicantEligibilityContext(
            nid,
            NationalIdParser.CalculateAge(nid.BirthDate, referenceDate),
            grade,
            schoolCategory,
            schoolCategoryCode,
            certificateType,
            gradeSource,
            stage,
            nid.GovernorateCode);
    }

    private static IReadOnlyList<string> BuildFailedReasons(EligibilityChecks checks, CategoryEligibilitySettings settings)
    {
        var reasons = new List<string>();
        if (!checks.AgeCheck.Passed)
        {
            reasons.Add($"السن أكبر من الحد المسموح لهذه الفئة ({checks.AgeCheck.MaxAge})");
        }

        if (!checks.GenderCheck.Passed)
        {
            reasons.Add("النوع لا يطابق إعدادات الفئة");
        }

        if (!checks.StageCheck.Passed)
        {
            reasons.Add("مرحلة الالتحاق لا تطابق إعدادات الفئة");
        }

        if (!checks.GradesCheck.Passed)
        {
            if (!checks.GradesCheck.HasGrade)
            {
                reasons.Add("لا يوجد سجل درجات مرتبط بهذا الرقم القومي");
            }
            else if (!string.IsNullOrWhiteSpace(settings.RequiredGradesSource))
            {
                reasons.Add($"فئة المدرسة لا تطابق مصدر الدرجات المطلوب ({settings.RequiredGradesSource})");
            }
            else
            {
                reasons.Add("فئة المدرسة لا تطابق إعدادات الفئة");
            }
        }

        return reasons;
    }

    private static JsonObject LookupToJson(Modules.Lookups.LookupRowEntity entity)
    {
        var obj = EligibilityJson.ParseObject(entity.PayloadJson);
        obj["code"] = entity.Code;
        obj["name"] = entity.Name;
        obj["isActive"] = entity.IsActive;
        return obj;
    }
}
