using System.Text.Json.Nodes;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

public sealed record ApplicantEligibilityResponse(
    string NationalId,
    ApplicantDerivedEligibility Derived,
    JsonObject? Grade,
    string CycleId,
    IReadOnlyList<CategoryEligibilityResult> Categories);

public sealed record ApplicantDerivedEligibility(
    DateOnly BirthDate,
    int Age,
    string Gender,
    string Governorate);

public sealed record CategoryEligibilityResult(
    string CategoryId,
    string CategoryName,
    bool Eligible,
    DateOnly? ApplicationStartDate,
    DateOnly? ApplicationEndDate,
    DateOnly? AgeReferenceDate,
    int? MaxAge,
    EligibilityChecks Checks,
    IReadOnlyList<EligibleCommitteeResult> Committees,
    IReadOnlyList<EligibleAcademicProgramResult> AcademicPrograms,
    IReadOnlyList<string> AllowedMaritalStatusCodes,
    IReadOnlyList<string> AllowedAcademicDegreeCodes,
    IReadOnlyList<string> AllowedAcademicGradeCodes,
    IReadOnlyList<int> AllowedGraduationYears,
    IReadOnlyList<string> FailedReasons);

public sealed record EligibleCommitteeResult(
    string CommitteeId,
    string CommitteeName,
    string Reason,
    IReadOnlyList<string> ExamDates,
    IReadOnlyList<EligibleCommitteeExamSlot> ExamSlots);

public sealed record EligibleCommitteeExamSlot(
    string Id,
    string Date,
    int Capacity,
    int Reserved);

public sealed record EligibleAcademicProgramResult(
    string FacultyCode,
    string FacultyName,
    string SpecializationCode,
    string SpecializationName,
    string Reason);

public sealed record EligibilityChecks(
    AgeCheckResult AgeCheck,
    GenderCheckResult GenderCheck,
    StageCheckResult StageCheck,
    GradesCheckResult GradesCheck);

public sealed record AgeCheckResult(bool Passed, int ApplicantAge, int? MaxAge, int? MinAge = null);

public sealed record GenderCheckResult(bool Passed, string ApplicantGender, IReadOnlyList<string> AllowedGender);

public sealed record StageCheckResult(bool Passed, string? RequiredStage, string? ApplicantStage);

public sealed record GradesCheckResult(
    bool Passed,
    bool HasGrade,
    string? SchoolCategory,
    IReadOnlyList<JsonObject> MatchedLookup,
    string? Source)
{
    public string? FailureCode { get; init; }
}

internal sealed record ApplicantEligibilityContext(
    EgyptianNationalIdInfo NationalId,
    int Age,
    JsonObject? Grade,
    string? SchoolCategory,
    string? SchoolCategoryCode,
    string? CertificateType,
    string? GradeSource,
    int? GraduationYear,
    decimal? GradePercentage,
    string? AcademicGradeId,
    string? Stage,
    string Governorate);

internal sealed record CategoryEligibilitySettings(
    string CategoryId,
    string CategoryName,
    JsonObject CategoryLookup,
    IReadOnlyList<ApplicationSettingsGraduationYearEntity> Rules,
    IReadOnlyList<JsonObject> SchoolCategoryLookups)
{
    public IReadOnlyList<string> RequiredSchoolCategoryCodes { get; init; } =
        Rules.SelectMany(x => EligibilityJson.StringArray(x.SchoolCategoryCodesJson))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public IReadOnlyList<int> RequiredGraduationYears { get; init; } =
        Rules.SelectMany(x => EligibilityJson.IntArray(x.GraduationYearsJson))
            .Distinct()
            .ToArray();

    public IReadOnlyList<string> AllowedGenders { get; init; } =
        Rules.SelectMany(x => EligibilityJson.StringArray(x.GenderTypesJson))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public int? MaxAge { get; init; } =
        Rules.Select(x => x.MaxAge).Where(x => x is not null).Min();

    public int? MinAge { get; init; } =
        Rules.Select(x => x.AgeMin).Where(x => x is not null).Max()
        ?? EligibilityJson.IntProp(CategoryLookup, "minAge")
        ?? 17;

    public DateOnly? AgeReferenceDate { get; init; } =
        Rules.Select(x => (DateOnly?)x.AgeReferenceDate).OrderBy(x => x).FirstOrDefault();

    public string? RequiredStage { get; init; } =
        EligibilityJson.FirstString(
            EligibilityJson.ObjectProp(CategoryLookup, "metadata"),
            "requiredStage",
            "stage",
            "مرحلة الالتحاق")
        ?? EligibilityJson.FirstString(
            CategoryLookup,
            "requiredStage",
            "stage",
            "مرحلة الالتحاق");

    public string? RequiredGradesSource { get; init; } =
        EligibilityJson.FirstString(
            EligibilityJson.ObjectProp(CategoryLookup, "metadata"),
            "requiredGradesSource",
            "gradesSource",
            "مصدر الدرجات")
        ?? EligibilityJson.FirstString(
            CategoryLookup,
            "requiredGradesSource",
            "gradesSource",
            "مصدر الدرجات");

    public decimal? MinPercentage { get; init; } =
        Rules.Select(x => x.MinPercentage).Where(x => x is not null).Max();

    public string? AcademicGradeId { get; init; } =
        Rules.Select(x => x.AcademicGradeId)
            .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

    public bool ValidateGrades { get; init; } = true;

    public bool AllowsManualGradeEntryWithoutRecord { get; init; }
}

internal sealed record EligibilityLookupSnapshot(
    IReadOnlyList<JsonObject> SchoolCategories,
    IReadOnlyList<JsonObject> AcademicGrades);
