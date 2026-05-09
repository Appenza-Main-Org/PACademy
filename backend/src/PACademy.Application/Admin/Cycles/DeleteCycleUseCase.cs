using Microsoft.EntityFrameworkCore;
using PACademy.Application.Audit;
using PACademy.Application.Common;
using PACademy.Domain.Audit;
using PACademy.Domain.Cycles;

namespace PACademy.Application.Admin.Cycles;

public sealed class DeleteCycleUseCase(
    IPaDbContext db,
    IAuditWriter audit)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var cycle = await db.Cycles.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cycle is null) return false;

        if (cycle.Status != CycleStatus.Draft)
            throw new DomainConflictException(
                "Only Draft cycles may be hard-deleted. Use the Closed → Archived transition instead.",
                "INVALID_CYCLE_TRANSITION");

        var hasApplicants = await db.Applicants.AnyAsync(a => a.CycleId == id, ct);
        if (hasApplicants)
            throw new DomainConflictException(
                "Cannot delete a cycle that has applicants attached.",
                "CYCLE_HAS_APPLICANTS");

        // Cycle implements ISoftDeletable, so a tracked Remove() would be
        // intercepted by PaDbContext.HandleSoftDeletes and silently turned into
        // an Archived flip. Use ExecuteDeleteAsync to issue a real DELETE that
        // bypasses the change tracker. EmitAuditEntries does NOT fire for
        // ExecuteDeleteAsync, so write the audit row explicitly first.
        await audit.RecordAsync(
            AuditAction.Delete, "cycle", cycle.Id, cycle.NameAr,
            AuditOutcome.Success, null, null, ct);
        await db.SaveChangesAsync(ct);

        var rowsDeleted = await db.Cycles.Where(c => c.Id == id).ExecuteDeleteAsync(ct);
        return rowsDeleted > 0;
    }
}
