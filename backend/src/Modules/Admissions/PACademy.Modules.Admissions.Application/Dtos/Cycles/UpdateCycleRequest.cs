using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record UpdateCycleRequest(
    string? NameAr,
    DateTime? OpenDate,
    DateTime? CloseDate,
    int? ExpectedCapacity,
    Dictionary<string, OpenCategoryEntryDto>? OpenCategories,
    Dictionary<string, JsonElement>? ConditionOverrides);
