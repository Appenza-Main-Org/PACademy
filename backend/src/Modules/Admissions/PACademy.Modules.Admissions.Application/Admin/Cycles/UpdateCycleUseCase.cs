using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class UpdateCycleUseCase(IAdmissionsDbContext db)
{
    public async Task<CycleDetailDto?> ExecuteAsync(
        Guid id,
        UpdateCycleRequest request,
        CancellationToken ct = default)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cycle is null) return null;

        string? openCatJson = request.OpenCategories is not null
            ? JsonSerializer.Serialize(request.OpenCategories)
            : null;
        string? overridesJson = request.ConditionOverrides is not null
            ? JsonSerializer.Serialize(request.ConditionOverrides)
            : null;

        cycle.Update(
            request.NameAr,
            request.OpenDate,
            request.CloseDate,
            request.ExpectedCapacity,
            openCatJson,
            overridesJson);

        await db.SaveChangesAsync(ct);

        var applicantCount = await db.Applicants.AsNoTracking()
            .CountAsync(a => a.CycleId == id, ct);

        return GetCycleUseCase.MapToDetailDto(cycle, applicantCount);
    }
}
