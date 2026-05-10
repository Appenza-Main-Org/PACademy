namespace PACademy.Contracts.Admin.Lookups;

public sealed record SpecializationDto(
    Guid Id, string Key, string NameAr, string Code, string FacultyType,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateSpecializationRequest(
    string Key, string NameAr, string Code, string FacultyType, int? SortOrder);

public sealed record UpdateSpecializationRequest(
    string? NameAr, string? Code, string? FacultyType, int? SortOrder, bool? IsActive);
