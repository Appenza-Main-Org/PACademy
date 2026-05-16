using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Domain.Cycles;
using System.Text.Json;

namespace PACademy.Application.Admin.Cycles;

public sealed class GetCycleUseCase(IPaDbContext db)
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
            c.OpenDate, c.CloseDate,
            applicantCount,
            openCategories,
            conditionOverrides,
            c.CreatedAt,
            c.ArchivedAt,
            Convert.ToBase64String(c.RowVersion));
    }
}
