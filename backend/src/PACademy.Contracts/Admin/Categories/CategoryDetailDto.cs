using System.Text.Json;

namespace PACademy.Contracts.Admin.Categories;

public sealed record CategoryDetailDto(
    Guid Id,
    string Key,
    string NameAr,
    string? NameEn,
    string? Description,
    JsonElement Conditions,
    JsonElement RequiredTests,
    JsonElement Procedures,
    int SortOrder,
    bool IsActive,
    bool IsSpec,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool DemoOrigin,
    string RowVersion);
