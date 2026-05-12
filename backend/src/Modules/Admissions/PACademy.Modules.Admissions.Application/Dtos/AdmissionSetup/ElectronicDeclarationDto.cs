namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record ElectronicDeclarationDto(
    Guid Id,
    Guid CycleId,
    string BodyAr,
    int Version,
    DateTime EffectiveFrom,
    DateTime? PublishedAt,
    bool IsArchived,
    DateTime CreatedAt,
    Guid CreatedBy,
    string RowVersion);

public sealed record CreateDeclarationRequest(string BodyAr, DateTime EffectiveFrom);

public sealed record UpdateDeclarationRequest(string? BodyAr, DateTime? EffectiveFrom, string RowVersion);

public sealed record PublishDeclarationRequest(string RowVersion);
