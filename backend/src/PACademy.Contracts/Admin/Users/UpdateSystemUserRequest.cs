namespace PACademy.Contracts.Admin.Users;

public sealed record UpdateSystemUserRequest(
    string? FullName,
    string? Mobile,
    string? Email,
    string? Unit,
    string? Role,
    bool? IsActive);
