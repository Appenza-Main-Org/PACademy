namespace PACademy.Contracts.Admin.Lookups;

public sealed record CaseTypeDto(
    Guid Id, string Key, string NameAr, string Severity, bool BlocksApplication,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateCaseTypeRequest(
    string Key, string NameAr, string Severity, bool BlocksApplication, int? SortOrder);

public sealed record UpdateCaseTypeRequest(
    string? NameAr, string? Severity, bool? BlocksApplication, int? SortOrder, bool? IsActive);
