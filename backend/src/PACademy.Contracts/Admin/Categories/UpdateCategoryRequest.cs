using System.Text.Json;

namespace PACademy.Contracts.Admin.Categories;

public sealed record UpdateCategoryRequest(
    string? NameAr,
    string? NameEn,
    string? Description,
    JsonElement? Conditions,
    JsonElement? RequiredTests,
    JsonElement? Procedures,
    int? SortOrder,
    bool? IsActive,
    string? RowVersion = null);
