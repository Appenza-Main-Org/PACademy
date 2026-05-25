using System.Text.Json.Nodes;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

internal delegate object EligibilityCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups);

internal static class EligibilityCheckRegistry
{
    public static readonly IReadOnlyDictionary<string, EligibilityCheck> Checks =
        new Dictionary<string, EligibilityCheck>(StringComparer.Ordinal)
        {
            ["ageCheck"] = AgeCheck,
            ["genderCheck"] = GenderCheck,
            ["stageCheck"] = StageCheck,
            ["gradesCheck"] = GradesCheck
        };

    public static AgeCheckResult AgeCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups)
    {
        _ = lookups;
        var referenceDate = category.AgeReferenceDate ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var age = NationalIdParser.CalculateAge(applicant.NationalId.BirthDate, referenceDate);
        var passed = (category.MinAge is null || age >= category.MinAge.Value) &&
            (category.MaxAge is null || age <= category.MaxAge.Value);
        return new AgeCheckResult(passed, age, category.MaxAge, category.MinAge);
    }

    public static GenderCheckResult GenderCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups)
    {
        _ = lookups;
        var applicantGenderValues = new[]
        {
            applicant.NationalId.Gender.ToString().ToLowerInvariant(),
            applicant.NationalId.GenderAr
        };
        var passed = category.AllowedGenders.Count == 0 ||
            category.AllowedGenders.Any(allowed => applicantGenderValues.Any(value => EligibilityJson.TextEquals(allowed, value)));
        return new GenderCheckResult(passed, applicant.NationalId.GenderAr, category.AllowedGenders);
    }

    public static StageCheckResult StageCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups)
    {
        _ = lookups;
        if (string.IsNullOrWhiteSpace(category.RequiredStage))
        {
            return new StageCheckResult(true, null, applicant.Stage);
        }

        if (string.IsNullOrWhiteSpace(applicant.Stage))
        {
            return new StageCheckResult(false, category.RequiredStage, null);
        }

        return new StageCheckResult(
            EligibilityJson.TextEquals(category.RequiredStage, applicant.Stage),
            category.RequiredStage,
            applicant.Stage);
    }

    public static GradesCheckResult GradesCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups)
    {
        var hasGrade = applicant.Grade is not null;
        if (!RequiresGrade(category))
        {
            return new GradesCheckResult(true, hasGrade, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (!hasGrade)
        {
            return new GradesCheckResult(false, false, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (category.RequiredGraduationYears.Count > 0 &&
            (applicant.GraduationYear is null || !category.RequiredGraduationYears.Contains(applicant.GraduationYear.Value)))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (category.MinPercentage is not null &&
            (applicant.GradePercentage is null || applicant.GradePercentage.Value < category.MinPercentage.Value))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (!string.IsNullOrWhiteSpace(category.AcademicGradeId) &&
            !EligibilityJson.TextEquals(category.AcademicGradeId, applicant.AcademicGradeId))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        var matched = lookups.SchoolCategories
            .Where(row => MatchesSchoolCategory(row, applicant, category))
            .Select(EligibilityJson.Clone)
            .ToArray();

        return new GradesCheckResult(
            matched.Length > 0,
            true,
            applicant.SchoolCategory,
            matched,
            applicant.GradeSource);
    }

    private static bool RequiresGrade(CategoryEligibilitySettings category) =>
        category.RequiredSchoolCategoryCodes.Count > 0 ||
        category.RequiredGraduationYears.Count > 0 ||
        category.MinPercentage is not null ||
        !string.IsNullOrWhiteSpace(category.AcademicGradeId) ||
        !string.IsNullOrWhiteSpace(category.RequiredGradesSource) ||
        !string.IsNullOrWhiteSpace(category.RequiredStage);

    private static bool MatchesSchoolCategory(
        JsonObject lookup,
        ApplicantEligibilityContext applicant,
        CategoryEligibilitySettings category)
    {
        var lookupCode = EligibilityJson.StringProp(lookup, "code");
        if (category.RequiredSchoolCategoryCodes.Count > 0 &&
            (lookupCode is null || !category.RequiredSchoolCategoryCodes.Contains(lookupCode, StringComparer.OrdinalIgnoreCase)))
        {
            return false;
        }

        var lookupNames = new[]
        {
            EligibilityJson.StringProp(lookup, "name"),
            EligibilityJson.StringProp(lookup, "certificateType"),
            EligibilityJson.StringProp(lookup, "certificateTypeName"),
            EligibilityJson.StringProp(lookup, "نوع الشهادة"),
            lookupCode
        };
        var applicantNames = new[] { applicant.SchoolCategory, applicant.CertificateType, applicant.SchoolCategoryCode };
        if (!lookupNames.Any(lookupValue => applicantNames.Any(applicantValue => EligibilityJson.TextEquals(lookupValue, applicantValue))))
        {
            return false;
        }

        var source = EligibilityJson.FirstString(lookup, "gradesSource", "source", "مصدر الدرجات");
        if (!string.IsNullOrWhiteSpace(applicant.GradeSource) &&
            !string.IsNullOrWhiteSpace(source) &&
            !EligibilityJson.TextEquals(source, applicant.GradeSource))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(category.RequiredGradesSource))
        {
            if (!EligibilityJson.TextEquals(source, category.RequiredGradesSource)) return false;
        }

        return true;
    }
}
