namespace PACademy.Modules.ReferenceData.Application.Dtos;

public sealed record UpdateReferenceDataRequest(
    string? NameAr,
    string? NameEn,
    string? Metadata,
    int? SortOrder,
    bool? IsActive);
