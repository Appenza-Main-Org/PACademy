namespace PACademy.Contracts.Admin.Users;

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
