namespace PACademy.Modules.Identity.Application.Admin.Users;

public sealed record SystemUserDetailDto(
    Guid Id,
    string NationalId,
    string FullName,
    string Role,
    string Mobile,
    string? Email,
    string? Unit,
    bool IsActive,
    DateTime CreatedAt,
    bool DemoOrigin,
    string OfficerCode,
    DateTime IssueDate,
    string CardFactoryNumber,
    DateTime? ArchivedAt);

public sealed record SystemUserListItemDto(
    Guid Id,
    string NationalId,
    string FullName,
    string Role,
    string Mobile,
    string? Email,
    string? Unit,
    bool IsActive,
    DateTime CreatedAt,
    bool DemoOrigin);

public sealed record SystemUserListFilters(
    string? Role = null,
    string? Q = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = null,
    string? SortDir = null);

public sealed record CreateSystemUserRequest(
    string NationalId,
    string OfficerCode,
    string FullName,
    string Mobile,
    string Email,
    string? Unit,
    string Role,
    DateTime IssueDate,
    string CardFactoryNumber,
    string Password);

public sealed record UpdateSystemUserRequest(
    string? FullName,
    string? Mobile,
    string? Email,
    string? Unit,
    string? Role,
    bool? IsActive);
