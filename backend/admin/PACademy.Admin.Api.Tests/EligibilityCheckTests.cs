using System.Text.Json;
using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Tests;

public sealed class EligibilityCheckTests
{
    [Fact]
    public void AgeCheckPassesOnlyWhenApplicantAgeIsWithinConfiguredMax()
    {
        var applicant = Applicant("30001010123457", referenceDate: new DateOnly(2026, 1, 1));
        var category = Category(maxAge: 26);

        var pass = EligibilityCheckRegistry.AgeCheck(applicant, category, Lookups());
        var fail = EligibilityCheckRegistry.AgeCheck(applicant, Category(maxAge: 25), Lookups());

        Assert.True(pass.Passed);
        Assert.False(fail.Passed);
        Assert.Equal(26, fail.ApplicantAge);
    }

    [Fact]
    public void GenderCheckUsesConfiguredAllowedGenderValues()
    {
        var male = Applicant("30001010123457");
        var category = Category(genders: ["أنثى"]);

        var result = EligibilityCheckRegistry.GenderCheck(male, category, Lookups());

        Assert.False(result.Passed);
        Assert.Equal("ذكر", result.ApplicantGender);
        Assert.Equal(["أنثى"], result.AllowedGender);
    }

    [Fact]
    public void StageCheckComparesApplicantContextToConfiguredStage()
    {
        var applicant = Applicant("30001010123457", stage: "ثانوي");
        var category = Category(requiredStage: "جامعي");

        var result = EligibilityCheckRegistry.StageCheck(applicant, category, Lookups());

        Assert.False(result.Passed);
        Assert.Equal("جامعي", result.RequiredStage);
        Assert.Equal("ثانوي", result.ApplicantStage);
    }

    [Fact]
    public void GradesCheckReturnsAllAttributeMatchedLookups()
    {
        var applicant = Applicant(
            "30001010123457",
            grade: Grade("SCH-EXT", "ثانوية عامة", "general"));
        var category = Category(
            schoolCategoryCodes: ["SCH-EXT", "SCH-EXT-2"],
            requiredGradesSource: "استيراد خارجي",
            requiredStage: "general");
        var lookups = Lookups(
            SchoolLookup("SCH-EXT", "ثانوية عامة", "استيراد خارجي"),
            SchoolLookup("SCH-EXT-2", "ثانوية عامة", "استيراد خارجي"));

        var result = EligibilityCheckRegistry.GradesCheck(applicant, category, lookups);

        Assert.True(result.Passed);
        Assert.True(result.HasGrade);
        Assert.Equal(2, result.MatchedLookup.Count);
    }

    [Fact]
    public void GradesCheckRejectsSameCertificateTypeWhenSourceDiffers()
    {
        var applicant = Applicant(
            "30001010123457",
            grade: Grade("SCH-INT", "ثانوية عامة", "general"));
        var category = Category(
            schoolCategoryCodes: ["SCH-INT"],
            requiredGradesSource: "استيراد خارجي",
            requiredStage: "general");
        var lookups = Lookups(SchoolLookup("SCH-INT", "ثانوية عامة", "إدخال داخلي"));

        var result = EligibilityCheckRegistry.GradesCheck(applicant, category, lookups);

        Assert.False(result.Passed);
        Assert.Empty(result.MatchedLookup);
    }

    [Fact]
    public void GradesCheckAllowsManualEntrySchoolCategoriesWhenNoGradeRowExists()
    {
        var applicant = Applicant("30001010123457");
        var category = Category(allowManualGradeEntryWithoutRecord: true);
        var lookups = Lookups(SchoolLookup("SCH-MAN", "الشهادة الثانوية من الخارج", "إدخال يدوي"));

        var result = EligibilityCheckRegistry.GradesCheck(applicant, category, lookups);

        Assert.True(result.Passed);
        Assert.False(result.HasGrade);
        Assert.Single(result.MatchedLookup);
        Assert.Equal("إدخال يدوي", result.Source);
    }

    private static ApplicantEligibilityContext Applicant(
        string nationalId,
        JsonObject? grade = null,
        string? stage = null,
        DateOnly? referenceDate = null)
    {
        var info = NationalIdParser.ParseEgyptianNationalId(nationalId);
        return new ApplicantEligibilityContext(
            info,
            NationalIdParser.CalculateAge(info.BirthDate, referenceDate ?? new DateOnly(2026, 1, 1)),
            grade,
            EligibilityJson.FirstString(grade, "schoolCategoryName", "schoolCategory", "kind"),
            EligibilityJson.FirstString(grade, "schoolCategoryCode", "schoolCategory"),
            EligibilityJson.FirstString(grade, "certificateType", "schoolCategoryName", "kind"),
            EligibilityJson.FirstString(grade, "gradesSource", "source"),
            EligibilityJson.IntProp(grade, "graduationYear"),
            EligibilityJson.DecimalProp(grade, "percentage"),
            EligibilityJson.FirstString(grade, "academicGradeId", "academicGrade"),
            stage ?? EligibilityJson.FirstString(grade, "stage", "kind"),
            info.GovernorateCode);
    }

    private static CategoryEligibilitySettings Category(
        int? maxAge = null,
        int? minAge = null,
        IReadOnlyList<string>? genders = null,
        IReadOnlyList<string>? schoolCategoryCodes = null,
        string? requiredGradesSource = null,
        string? requiredStage = null,
        bool allowManualGradeEntryWithoutRecord = false)
    {
        var categoryLookup = new JsonObject
        {
            ["code"] = "CAT-TEST",
            ["name"] = "قسم تجريبي"
        };
        if (requiredStage is not null) categoryLookup["requiredStage"] = requiredStage;
        if (requiredGradesSource is not null)
        {
            categoryLookup["metadata"] = new JsonObject { ["requiredGradesSource"] = requiredGradesSource };
        }

        var rule = new ApplicationSettingsGraduationYearEntity
        {
            Id = "asy-test",
            CategorySpecializationId = "acs-test",
            GraduationYearsJson = "[2026]",
            GenderTypesJson = JsonSerializer.Serialize(genders ?? []),
            MaritalStatusCodesJson = "[]",
            AgeMin = minAge,
            MaxAge = maxAge,
            DivisionCodesJson = "[]",
            SchoolCategoryCodesJson = JsonSerializer.Serialize(schoolCategoryCodes ?? []),
            ApplicationStartDate = new DateOnly(2026, 1, 1),
            ApplicationEndDate = new DateOnly(2026, 12, 31),
            AgeReferenceDate = new DateOnly(2026, 1, 1),
            IsActive = true,
            GradeKind = "GRADES",
            MinPercentage = 50,
            AcademicGradeId = null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        return new CategoryEligibilitySettings("CAT-TEST", "قسم تجريبي", categoryLookup, [rule], [])
        {
            AllowsManualGradeEntryWithoutRecord = allowManualGradeEntryWithoutRecord
        };
    }

    private static JsonObject Grade(string code, string certificateType, string stage) => new()
    {
        ["nid"] = "30001010123457",
        ["schoolCategoryCode"] = code,
        ["schoolCategoryName"] = certificateType,
        ["certificateType"] = certificateType,
        ["graduationYear"] = 2026,
        ["percentage"] = 80,
        ["kind"] = stage
    };

    private static EligibilityLookupSnapshot Lookups(params JsonObject[] rows) => new(rows, []);

    private static JsonObject SchoolLookup(string code, string certificateType, string source) => new()
    {
        ["code"] = code,
        ["name"] = certificateType,
        ["certificateType"] = certificateType,
        ["gradesSource"] = source
    };
}
