namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record ApplicantDetailDto(
    Guid Id,
    string NationalId,
    string FullName,
    Guid CycleId,
    string Status,
    DateTime? DateOfBirth,
    string? Gender,
    string? Mobile,
    string? Email,
    string? Governorate,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid CreatedBy,
    Guid? UpdatedBy,
    string? LastModifiedBy,
    bool DemoOrigin);
