namespace PACademy.Contracts.Admin.ReferenceData;

public sealed record ReferenceDataListFilters(
    string? Category = null,
    bool? IsActive = null,
    bool IncludeArchived = false,
    int Page = 1,
    int PageSize = 50,
    string? SortBy = null,
    string? SortDir = null);
