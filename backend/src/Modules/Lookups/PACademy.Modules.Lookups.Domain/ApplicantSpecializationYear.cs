namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Tier 3 of the Application Settings hierarchy (spec 011) — the leaf
/// row carrying eligibility constraints per (category-specialization ×
/// graduation-year-set × gender-set).
///
/// Multi-select sets (graduation years, genders, marital codes, division
/// codes, school-category codes) are stored as JSON arrays. The app layer
/// validates DUPLICATE_YEAR / OVERLAPPING_PERIOD / GENDER_REQUIRED /
/// AGE_NOT_POSITIVE / GRADE_RANGE_INVALID before SaveChanges.
///
/// <c>GradeKind</c> is the discriminator — <c>"GRADES"</c> rows carry
/// <see cref="MinPercentage"/>; <c>"TAGDIR"</c> rows carry
/// <see cref="AcademicGradeId"/>. The chosen branch is derived at
/// row-creation time from the parent category's submission-type
/// <c>gradingMode</c> and is immutable thereafter.
/// </summary>
public sealed class ApplicantSpecializationYear
{
    public const string GradeKindGrades = "GRADES";
    public const string GradeKindTagdir = "TAGDIR";

    private ApplicantSpecializationYear() { }

    public Guid Id { get; private set; }
    public Guid CategorySpecializationId { get; private set; }

    public string GraduationYearsJson { get; private set; } = "[]";
    public string GenderTypesJson { get; private set; } = "[]";
    public string MaritalStatusCodesJson { get; private set; } = "[]";
    public string DivisionCodesJson { get; private set; } = "[]";
    public string SchoolCategoryCodesJson { get; private set; } = "[]";

    public int? AgeMin { get; private set; }
    public int? MaxAge { get; private set; }

    public DateOnly ApplicationStartDate { get; private set; }
    public DateOnly ApplicationEndDate { get; private set; }
    public DateOnly AgeReferenceDate { get; private set; }

    public bool IsActive { get; private set; }

    public string GradeKind { get; private set; } = GradeKindGrades;
    public int? MinPercentage { get; private set; }
    public string? AcademicGradeId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = Array.Empty<byte>();

    /// <summary>
    /// Factory — does NOT validate domain invariants (handled by the
    /// use-case layer alongside cross-row checks like DUPLICATE_YEAR).
    /// </summary>
    public static ApplicantSpecializationYear Create(
        Guid id,
        Guid categorySpecializationId,
        string graduationYearsJson,
        string genderTypesJson,
        string maritalStatusCodesJson,
        string divisionCodesJson,
        string schoolCategoryCodesJson,
        int? ageMin,
        int? maxAge,
        DateOnly applicationStartDate,
        DateOnly applicationEndDate,
        DateOnly ageReferenceDate,
        bool isActive,
        string gradeKind,
        int? minPercentage,
        string? academicGradeId,
        DateTimeOffset now)
    {
        return new ApplicantSpecializationYear
        {
            Id = id,
            CategorySpecializationId = categorySpecializationId,
            GraduationYearsJson = graduationYearsJson,
            GenderTypesJson = genderTypesJson,
            MaritalStatusCodesJson = maritalStatusCodesJson,
            DivisionCodesJson = divisionCodesJson,
            SchoolCategoryCodesJson = schoolCategoryCodesJson,
            AgeMin = ageMin,
            MaxAge = maxAge,
            ApplicationStartDate = applicationStartDate,
            ApplicationEndDate = applicationEndDate,
            AgeReferenceDate = ageReferenceDate,
            IsActive = isActive,
            GradeKind = gradeKind,
            MinPercentage = minPercentage,
            AcademicGradeId = academicGradeId,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void Update(
        string graduationYearsJson,
        string genderTypesJson,
        string maritalStatusCodesJson,
        string divisionCodesJson,
        string schoolCategoryCodesJson,
        int? ageMin,
        int? maxAge,
        DateOnly applicationStartDate,
        DateOnly applicationEndDate,
        DateOnly ageReferenceDate,
        bool isActive,
        string gradeKind,
        int? minPercentage,
        string? academicGradeId,
        DateTimeOffset now)
    {
        GraduationYearsJson = graduationYearsJson;
        GenderTypesJson = genderTypesJson;
        MaritalStatusCodesJson = maritalStatusCodesJson;
        DivisionCodesJson = divisionCodesJson;
        SchoolCategoryCodesJson = schoolCategoryCodesJson;
        AgeMin = ageMin;
        MaxAge = maxAge;
        ApplicationStartDate = applicationStartDate;
        ApplicationEndDate = applicationEndDate;
        AgeReferenceDate = ageReferenceDate;
        IsActive = isActive;
        GradeKind = gradeKind;
        MinPercentage = minPercentage;
        AcademicGradeId = academicGradeId;
        UpdatedAt = now;
    }

    public void SetActive(bool isActive, DateTimeOffset now)
    {
        IsActive = isActive;
        UpdatedAt = now;
    }
}
