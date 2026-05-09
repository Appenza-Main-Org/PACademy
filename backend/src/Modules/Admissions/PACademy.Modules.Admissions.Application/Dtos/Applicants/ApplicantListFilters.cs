namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record ApplicantListFilters(
    Guid? CycleId = null,
    string? Status = null,
    string? Q = null,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = null,
    string? SortDir = null);
