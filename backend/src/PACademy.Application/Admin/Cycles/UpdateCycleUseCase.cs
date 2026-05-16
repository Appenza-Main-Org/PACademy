using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Cycles;
using System.Text.Json;

namespace PACademy.Application.Admin.Cycles;

public sealed class UpdateCycleUseCase(IPaDbContext db)
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
            openCatJson,
            overridesJson);

        // EmitAuditEntries writes the audit row automatically.
        await db.SaveChangesAsync(ct);

        var applicantCount = await db.Applicants.AsNoTracking()
            .CountAsync(a => a.CycleId == id, ct);

        return GetCycleUseCase.MapToDetailDto(cycle, applicantCount);
    }
}
