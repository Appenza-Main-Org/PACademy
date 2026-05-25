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
            .Where(x => x.IsActive && (x.LookupKey == "applicant-categories" || x.LookupKey == "school-categories" || x.LookupKey == "committees"))
            .ToListAsync(ct);
        var categoryLookups = lookupRows
            .Where(x => x.LookupKey == "applicant-categories")
            .Select(LookupToJson)
            .ToDictionary(x => EligibilityJson.StringProp(x, "code") ?? "", StringComparer.OrdinalIgnoreCase);
        var committeeLookups = lookupRows
            .Where(x => x.LookupKey == "committees")
            .Select(LookupToJson)
            .ToArray();
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

            var evaluation = EvaluateCategory(applicant, settings, lookups);
            var checks = evaluation.Checks;
            var failedReasons = evaluation.FailedReasons;
            var committees = failedReasons.Count == 0
                ? ResolveCommittees(committeeLookups, settings.CategoryId, settings.CategoryName)
                : [];
            results.Add(new CategoryEligibilityResult(
                settings.CategoryId,
                settings.CategoryName,
                failedReasons.Count == 0,
                checks,
                committees,
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
        var graduationYear = EligibilityJson.IntProp(grade, "graduationYear")
            ?? EligibilityJson.IntProp(grade, "year")
            ?? EligibilityJson.IntProp(grade, "سنة التخرج");
        var percentage = EligibilityJson.DecimalProp(grade, "percentage")
            ?? EligibilityJson.DecimalProp(grade, "effectivePercentage")
            ?? EligibilityJson.DecimalProp(grade, "percent")
            ?? CalculatePercentage(grade);
        var academicGradeId = EligibilityJson.FirstString(grade, "academicGradeId", "academicGrade", "grade", "tagdir", "التقدير");
        return new ApplicantEligibilityContext(
            nid,
            NationalIdParser.CalculateAge(nid.BirthDate, referenceDate),
            grade,
            schoolCategory,
            schoolCategoryCode,
            certificateType,
            gradeSource,
            graduationYear,
            percentage,
            academicGradeId,
            stage,
            nid.GovernorateCode);
    }

    private static CategoryEvaluation EvaluateCategory(
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings category,
        EligibilityLookupSnapshot lookups)
    {
        if (category.Rules.Count == 0)
        {
            var checks = RunChecks(applicant, category, lookups);
            return new CategoryEvaluation(checks, ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
        }

        CategoryEvaluation? best = null;
        foreach (var rule in category.Rules)
        {
            var rowSettings = category with
            {
                Rules = [rule],
                RequiredSchoolCategoryCodes = EligibilityJson.StringArray(rule.SchoolCategoryCodesJson),
                RequiredGraduationYears = EligibilityJson.IntArray(rule.GraduationYearsJson),
                AllowedGenders = EligibilityJson.StringArray(rule.GenderTypesJson),
                MaxAge = rule.MaxAge,
                MinAge = rule.AgeMin ?? EligibilityJson.IntProp(category.CategoryLookup, "minAge") ?? 17,
                AgeReferenceDate = rule.AgeReferenceDate,
                MinPercentage = rule.MinPercentage,
                AcademicGradeId = rule.AcademicGradeId
            };
            var checks = RunChecks(applicant, rowSettings, lookups);
            var failedReasons = BuildFailedReasons(checks, rowSettings);
            var evaluation = new CategoryEvaluation(checks, failedReasons);
            if (failedReasons.Count == 0)
            {
                return evaluation;
            }

            if (best is null || CountPassed(checks) > CountPassed(best.Checks))
            {
                best = evaluation;
            }
        }

        return best ?? new CategoryEvaluation(RunChecks(applicant, category, lookups), ["لا توجد إعدادات قبول نشطة لهذه الفئة"]);
    }

    private static EligibilityChecks RunChecks(
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings settings,
        EligibilityLookupSnapshot lookups)
    {
        var age = (AgeCheckResult)EligibilityCheckRegistry.Checks["ageCheck"](applicant, settings, lookups);
        var gender = (GenderCheckResult)EligibilityCheckRegistry.Checks["genderCheck"](applicant, settings, lookups);
        var stage = (StageCheckResult)EligibilityCheckRegistry.Checks["stageCheck"](applicant, settings, lookups);
        var grades = (GradesCheckResult)EligibilityCheckRegistry.Checks["gradesCheck"](applicant, settings, lookups);
        return new EligibilityChecks(age, gender, stage, grades);
    }

    private static int CountPassed(EligibilityChecks checks)
    {
        var count = 0;
        if (checks.AgeCheck.Passed) count++;
        if (checks.GenderCheck.Passed) count++;
        if (checks.StageCheck.Passed) count++;
        if (checks.GradesCheck.Passed) count++;
        return count;
    }

    private static IReadOnlyList<EligibleCommitteeResult> ResolveCommittees(
        IReadOnlyList<JsonObject> committeeLookups,
        string categoryId,
        string categoryName)
    {
        return committeeLookups
            .Where(row => EligibilityJson.TextEquals(EligibilityJson.FirstString(row, "applicantCategoryId", "categoryId", "categoryCode"), categoryId))
            .Select(row => new EligibleCommitteeResult(
                EligibilityJson.StringProp(row, "code") ?? "",
                EligibilityJson.StringProp(row, "name") ?? EligibilityJson.StringProp(row, "code") ?? "",
                $"مطابق لإعدادات فئة {categoryName} واللجنة مربوطة بهذه الفئة"))
            .Where(row => !string.IsNullOrWhiteSpace(row.CommitteeId))
            .ToArray();
    }

    private static decimal? CalculatePercentage(JsonObject? grade)
    {
        var total = EligibilityJson.DecimalProp(grade, "effectiveTotal")
            ?? EligibilityJson.DecimalProp(grade, "total")
            ?? EligibilityJson.DecimalProp(grade, "totalGrade");
        var max = EligibilityJson.DecimalProp(grade, "max")
            ?? EligibilityJson.DecimalProp(grade, "maxGrade")
            ?? EligibilityJson.DecimalProp(grade, "importMax");
        if (total is null || max is null || max <= 0) return null;
        return Math.Round((total.Value / max.Value) * 100, 2);
    }

    private static IReadOnlyList<string> BuildFailedReasons(EligibilityChecks checks, CategoryEligibilitySettings settings)
    {
        var reasons = new List<string>();
        if (!checks.AgeCheck.Passed)
        {
            reasons.Add("السن خارج النطاق المسموح لهذه الفئة");
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

    private sealed record CategoryEvaluation(
        EligibilityChecks Checks,
        IReadOnlyList<string> FailedReasons);

    private static JsonObject LookupToJson(Modules.Lookups.LookupRowEntity entity)
    {
        var obj = EligibilityJson.ParseObject(entity.PayloadJson);
        obj["code"] = entity.Code;
        obj["name"] = entity.Name;
        obj["isActive"] = entity.IsActive;
        return obj;
    }
}
