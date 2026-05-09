namespace PACademy.Modules.ReferenceData.Application.Dtos;

public sealed record ReferenceDataListItemDto(
    Guid Id,
    string Category,
    string Key,
    string NameAr,
    string? NameEn,
    int SortOrder,
    bool IsActive,
    bool Archived);
