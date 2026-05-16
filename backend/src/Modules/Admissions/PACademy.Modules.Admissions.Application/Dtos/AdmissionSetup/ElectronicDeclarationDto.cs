namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record ElectronicDeclarationDto(
    Guid Id,
    Guid CycleId,
    string Mode,
    string? BodyAr,
    DeclarationDocumentDto? Document,
    int Version,
    DateTime EffectiveFrom,
    DateTime? PublishedAt,
    bool IsArchived,
    DateTime CreatedAt,
    Guid CreatedBy,
    string RowVersion);

public sealed record DeclarationDocumentDto(
    string FileName,
    string FileUrl,
    long Size);

public sealed record CreateDeclarationRequest(
    string Mode,
    string? BodyAr,
    DeclarationDocumentDto? Document,
    DateTime EffectiveFrom);

public sealed record UpdateDeclarationRequest(
    string? Mode,
    string? BodyAr,
    DeclarationDocumentDto? Document,
    bool ClearDocument,
    DateTime? EffectiveFrom,
    string RowVersion);

public sealed record PublishDeclarationRequest(string RowVersion);

public sealed record UploadDeclarationDocumentResponse(
    string FileName,
    string FileUrl,
    long Size);
