namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CycleListFilters(
    string? Status = null,
    int? Year = null,
    string? Cohort = null,
    bool IncludeArchived = false,
    int Page = 1,
    int PageSize = 50);
