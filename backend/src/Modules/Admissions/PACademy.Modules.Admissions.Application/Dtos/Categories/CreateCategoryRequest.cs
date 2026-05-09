using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CreateCategoryRequest(
    string Key,
    string NameAr,
    string? NameEn,
    string? Description,
    JsonElement? Conditions,
    JsonElement? RequiredTests,
    JsonElement? Procedures,
    int? SortOrder);
