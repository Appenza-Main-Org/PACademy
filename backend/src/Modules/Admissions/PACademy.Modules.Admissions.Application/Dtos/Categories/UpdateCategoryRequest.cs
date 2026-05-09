using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record UpdateCategoryRequest(
    string? NameAr,
    string? NameEn,
    string? Description,
    JsonElement? Conditions,
    JsonElement? RequiredTests,
    JsonElement? Procedures,
    int? SortOrder,
    bool? IsActive);
