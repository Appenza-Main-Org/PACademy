namespace PACademy.Contracts.Admin.Lookups;

public sealed record CollegeDto(
    Guid Id, string Key, string NameAr, Guid GovernorateId, string Type,
    int SortOrder, bool IsActive, bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public sealed record CreateCollegeRequest(
    string Key, string NameAr, Guid GovernorateId, string Type, int? SortOrder);

public sealed record UpdateCollegeRequest(
    string? NameAr, Guid? GovernorateId, string? Type, int? SortOrder, bool? IsActive);

public sealed record CollegeListFilters(
    Guid? GovernorateId = null,
    string? Q = null, bool? IsActive = null, bool IncludeArchived = false,
    int Page = 1, int PageSize = 200, string? SortBy = null, string? SortDir = null)
    : LookupListFilters(Q, IsActive, IncludeArchived, Page, PageSize, SortBy, SortDir);
