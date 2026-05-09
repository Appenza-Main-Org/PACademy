namespace PACademy.Modules.ReferenceData.Application.Dtos;

public sealed record CreateReferenceDataRequest(
    string Category,
    string Key,
    string NameAr,
    string? NameEn,
    string? Metadata,
    int? SortOrder);
