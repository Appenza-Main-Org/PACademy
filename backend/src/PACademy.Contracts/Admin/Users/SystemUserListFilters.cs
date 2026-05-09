namespace PACademy.Contracts.Admin.Users;

public sealed record SystemUserListFilters(
    string? Role = null,
    string? Q = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = null,
    string? SortDir = null);
