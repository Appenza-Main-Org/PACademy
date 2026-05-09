namespace PACademy.Contracts.Admin.Cycles;

public sealed record CycleListFilters(
    string? Status = null,
    int? Year = null,
    string? Cohort = null,
    bool IncludeArchived = false,
    int Page = 1,
    int PageSize = 50);
