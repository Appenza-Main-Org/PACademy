namespace PACademy.Modules.Lookups.Application.ApplicationSettings;

public sealed record ApplicantCategoryConfigDto(
    string Id,
    string CategoryId,
    bool IsActive,
    int SortOrder,
    string CreatedAt,
    string UpdatedAt,
    string RowVersion);

public sealed record ApplicantCategorySpecializationDto(
    string Id,
    string ConfigId,
    string SpecializationId,
    bool IsActive,
    string CreatedAt,
    string RowVersion);

public sealed record ApplicantSpecializationYearDto(
    string Id,
    string CategorySpecializationId,
    IReadOnlyList<int> GraduationYears,
    IReadOnlyList<string> GenderTypes,
    IReadOnlyList<string> MaritalStatusCodes,
    IReadOnlyList<string> DivisionCodes,
    IReadOnlyList<string> SchoolCategoryCodes,
    int? AgeMin,
    int? MaxAge,
    string ApplicationStartDate,
    string ApplicationEndDate,
    string AgeReferenceDate,
    bool IsActive,
    string GradeKind,
    int? MinPercentage,
    string? AcademicGradeId,
    string CreatedAt,
    string UpdatedAt,
    string RowVersion);

public sealed record YearRowPayload(
    IReadOnlyList<int> GraduationYears,
    IReadOnlyList<string> GenderTypes,
    IReadOnlyList<string> MaritalStatusCodes,
    IReadOnlyList<string> DivisionCodes,
    IReadOnlyList<string> SchoolCategoryCodes,
    int? AgeMin,
    int? MaxAge,
    string ApplicationStartDate,
    string ApplicationEndDate,
    string AgeReferenceDate,
    bool IsActive,
    string GradeKind,
    int? MinPercentage,
    string? AcademicGradeId);

public sealed record CreateYearRequest(
    string CategorySpecializationId,
    YearRowPayload Row);

public sealed record UpdateYearRequest(
    YearRowPayload? Row,
    bool? IsActive,
    string RowVersion);

public sealed record AttachSpecializationRequest(string SpecializationId);

public sealed record PatchCategoryConfigRequest(bool? IsActive, int? SortOrder, string RowVersion);

public sealed record BulkYearChange(
    string? Id,
    string Kind,
    string CategorySpecializationId,
    YearRowPayload? Row);

public sealed record BulkSavePayload(IReadOnlyList<BulkYearChange> Changes);

public sealed record BulkSaveResult(int Created, int Updated, int Deleted);
