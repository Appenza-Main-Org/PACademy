using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Domain;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class DeleteCycleUseCase(
    IAdmissionsDbContext db,
    IAuditApi audit)
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

        // Cycle implements ISoftDeletable in the legacy layer; here we bypass soft-delete
        // by using ExecuteDeleteAsync. Audit must be written explicitly before the delete.
        await audit.RecordAsync(
            AuditAction.Delete, "cycle", cycle.Id, cycle.NameAr,
            AuditOutcome.Success, null, null, ct);
        await db.SaveChangesAsync(ct);

        var rowsDeleted = await db.Cycles.Where(c => c.Id == id).ExecuteDeleteAsync(ct);
        return rowsDeleted > 0;
    }
}
