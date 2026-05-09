using System.Text.Json;

namespace PACademy.Contracts.Admin.Cycles;

public sealed record UpdateCycleRequest(
    string? NameAr,
    DateTime? OpenDate,
    DateTime? CloseDate,
    int? ExpectedCapacity,
    Dictionary<string, OpenCategoryEntryDto>? OpenCategories,
    Dictionary<string, JsonElement>? ConditionOverrides);
