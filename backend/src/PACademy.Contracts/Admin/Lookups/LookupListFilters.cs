namespace PACademy.Contracts.Admin.Lookups;

/// <summary>
/// Common list-query filters shared by every lookup endpoint. Per-entity
/// filters extend this via inheritance only when they need additional
/// criteria (e.g., FacultyListFilters adds UniversityId).
/// </summary>
public record LookupListFilters(
    string? Q = null,
    bool? IsActive = null,
    bool IncludeArchived = false,
    int Page = 1,
    int PageSize = 200,
    string? SortBy = null,
    string? SortDir = null);
