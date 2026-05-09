namespace PACademy.Contracts.Admin.Users;

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
