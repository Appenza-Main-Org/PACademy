using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class GetCycleUseCase(IAdmissionsDbContext db)
{
    public async Task<CycleDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var cycle = await db.Cycles.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (cycle is null) return null;

        var applicantCount = await db.Applicants.AsNoTracking()
            .CountAsync(a => a.CycleId == id, ct);

        return MapToDetailDto(cycle, applicantCount);
    }

    internal static CycleDetailDto MapToDetailDto(Cycle c, int applicantCount)
    {
        var openCategories = JsonSerializer.Deserialize<Dictionary<string, OpenCategoryEntryDto>>(
            c.OpenCategoriesJson) ?? [];
        var conditionOverrides = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            c.ConditionOverridesJson) ?? [];

        return new CycleDetailDto(
            c.Id, c.NameAr, c.Year, c.Cohort,
            c.Status.ToString().ToLowerInvariant(),
            c.OpenDate, c.CloseDate, c.ExpectedCapacity,
            applicantCount,
            openCategories,
            conditionOverrides,
            c.CreatedAt,
            c.ArchivedAt);
    }
}
