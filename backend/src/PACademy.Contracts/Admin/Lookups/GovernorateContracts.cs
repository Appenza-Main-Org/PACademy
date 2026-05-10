namespace PACademy.Contracts.Admin.Lookups;

public sealed record GovernorateDto(
    Guid Id, string Key, string NameAr, string NameEn, string Region,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateGovernorateRequest(
    string Key, string NameAr, string NameEn, string Region, int? SortOrder);

public sealed record UpdateGovernorateRequest(
    string? NameAr, string? NameEn, string? Region, int? SortOrder, bool? IsActive);
