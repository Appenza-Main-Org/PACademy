using PACademy.Application.Common;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Domain.Cycles;

namespace PACademy.Application.Admin.Cycles;

public sealed class CreateCycleUseCase(
    IPaDbContext db,
    ICurrentUser currentUser)
{
    public async Task<CycleDetailDto> ExecuteAsync(
        CreateCycleRequest request,
        CancellationToken ct = default)
    {
        var cycle = Cycle.Create(
            request.NameAr,
            request.Year,
            request.Cohort,
            request.ExpectedCapacity,
            request.OpenDate,
            request.CloseDate,
            currentUser.Id);

        db.Cycles.Add(cycle);

        // PaDbContext.EmitAuditEntries handles the audit row automatically
        // because Cycle implements IAuditableWrite. Do not call IAuditWriter
        // here — that would write a duplicate row.
        await db.SaveChangesAsync(ct);

        return GetCycleUseCase.MapToDetailDto(cycle, 0);
    }
}
