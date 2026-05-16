using System.Text.Json;

namespace PACademy.Contracts.Admin.Cycles;

public sealed record CycleDetailDto(
    Guid Id,
    string NameAr,
    int Year,
    string Cohort,
    string Status,
    DateTime OpenDate,
    DateTime CloseDate,
    int ApplicantCount,
    Dictionary<string, OpenCategoryEntryDto> OpenCategories,
    Dictionary<string, JsonElement> ConditionOverrides,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    string RowVersion);
