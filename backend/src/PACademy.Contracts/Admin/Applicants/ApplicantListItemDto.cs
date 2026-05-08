namespace PACademy.Contracts.Admin.Applicants;

public sealed record ApplicantListItemDto(
    Guid Id,
    string NationalId,
    string FullName,
    Guid CycleId,
    string Status,
    string? Governorate,
    string? Mobile,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool DemoOrigin);
