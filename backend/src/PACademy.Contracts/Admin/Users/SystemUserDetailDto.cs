namespace PACademy.Contracts.Admin.Users;

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
