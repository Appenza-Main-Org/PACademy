using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Domain;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Admissions.Application.Admin.Common;

/// <summary>
/// Guards wizard write use-cases by ensuring the target cycle is in Draft status.
/// FR-006: writes against an active or closed cycle return 403.
/// Throws DomainConflictException (→ 422) when cycle is not Draft.
/// </summary>
public static class CycleStatusGuard
{
    public static async Task EnsureDraftAsync(
        IAdmissionsDbContext db,
        Guid cycleId,
        CancellationToken ct = default)
    {
        var cycle = await db.Cycles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cycleId, ct);

        if (cycle is null)
            throw new DomainConflictException("الدورة غير موجودة", "CYCLE_NOT_FOUND");

        if (cycle.Status != CycleStatus.Draft)
            throw new DomainConflictException(
                "لا يمكن تعديل دورة غير مسودة — يجب أن تكون الدورة في حالة مسودة",
                "CYCLE_NOT_DRAFT");
    }
}
