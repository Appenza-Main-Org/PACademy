namespace PACademy.Contracts.Admin.Lookups;

public sealed record QualificationDto(
    Guid Id, string Key, string NameAr, string Level, bool FacultyRequired,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateQualificationRequest(
    string Key, string NameAr, string Level, bool FacultyRequired, int? SortOrder);

public sealed record UpdateQualificationRequest(
    string? NameAr, string? Level, bool? FacultyRequired, int? SortOrder, bool? IsActive);
