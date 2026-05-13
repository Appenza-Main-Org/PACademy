namespace PACademy.Modules.Lookups.Application;

public sealed record CreateLookupItemRequest(
    string Code,
    string NameAr,
    string? NameEn,
    int SortOrder,
    Guid? ParentId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? ExtrasJson,
    string? FacultyCode);

public sealed record UpdateLookupItemRequest(
    string? NameAr,
    string? NameEn,
    int? SortOrder,
    Guid? ParentId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? ExtrasJson,
    string? FacultyCode,
    bool? IsActive,
    string RowVersion);

public sealed record SoftDeleteLookupItemRequest(string? Reason, string RowVersion);
