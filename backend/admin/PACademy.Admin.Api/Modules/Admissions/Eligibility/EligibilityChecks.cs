using System.Text.Json.Nodes;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

internal delegate object EligibilityCheck(ApplicantEligibilityContext applicant, CategoryEligibilitySettings category, EligibilityLookupSnapshot lookups);

internal static class GradesCheckFailureCodes
{
    public const string MissingGrade = "MISSING_GRADE";
    public const string GraduationYearMismatch = "GRADUATION_YEAR_MISMATCH";
    public const string BelowMinimumPercentage = "BELOW_MIN_PERCENTAGE";
    public const string AcademicGradeMismatch = "ACADEMIC_GRADE_MISMATCH";
    public const string SchoolCategoryMismatch = "SCHOOL_CATEGORY_MISMATCH";
}

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
        if (!category.ValidateGrades)
        {
            return new GradesCheckResult(true, hasGrade, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (!RequiresGrade(category))
        {
            return new GradesCheckResult(true, hasGrade, applicant.SchoolCategory, [], applicant.GradeSource);
        }

        if (!hasGrade)
        {
            if (!category.AllowsManualGradeEntryWithoutRecord)
            {
                return new GradesCheckResult(false, false, applicant.SchoolCategory, [], applicant.GradeSource)
                {
                    FailureCode = GradesCheckFailureCodes.MissingGrade
                };
            }

            var manualMatches = lookups.SchoolCategories
                .Where(IsManualEntrySchoolCategory)
                .Select(EligibilityJson.Clone)
                .ToArray();
            return new GradesCheckResult(
                manualMatches.Length > 0,
                false,
                applicant.SchoolCategory,
                manualMatches,
                "إدخال يدوي")
            {
                FailureCode = manualMatches.Length > 0 ? null : GradesCheckFailureCodes.SchoolCategoryMismatch
            };
        }

        if (category.RequiredGraduationYears.Count > 0 &&
            (applicant.GraduationYear is null || !category.RequiredGraduationYears.Contains(applicant.GraduationYear.Value)))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource)
            {
                FailureCode = GradesCheckFailureCodes.GraduationYearMismatch
            };
        }

        if (category.MinPercentage is not null &&
            (applicant.GradePercentage is null || applicant.GradePercentage.Value < category.MinPercentage.Value))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource)
            {
                FailureCode = GradesCheckFailureCodes.BelowMinimumPercentage
            };
        }

        if (!string.IsNullOrWhiteSpace(category.AcademicGradeId) &&
            !EligibilityJson.TextEquals(category.AcademicGradeId, applicant.AcademicGradeId))
        {
            return new GradesCheckResult(false, true, applicant.SchoolCategory, [], applicant.GradeSource)
            {
                FailureCode = GradesCheckFailureCodes.AcademicGradeMismatch
            };
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
            applicant.GradeSource)
        {
            FailureCode = matched.Length > 0 ? null : GradesCheckFailureCodes.SchoolCategoryMismatch
        };
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

    private static bool IsManualEntrySchoolCategory(JsonObject lookup)
    {
        var source = EligibilityJson.FirstString(lookup, "gradesSource", "source", "مصدر الدرجات");
        if (EligibilityJson.TextEquals(source, "إدخال يدوي")) return true;
        if (EligibilityJson.BoolProp(lookup, "externalGradesImport") is { } externalImport)
        {
            return !externalImport;
        }

        return false;
    }
}
