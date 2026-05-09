namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CategoryListItemDto(
    Guid Id,
    string Key,
    string NameAr,
    string? NameEn,
    int SortOrder,
    bool IsActive,
    bool IsSpec);
