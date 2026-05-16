using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Domain.Cycles;
using System.Data;

namespace PACademy.Application.Admin.Cycles;

public sealed class TransitionCycleStatusUseCase(IPaDbContext db)
{
    private static readonly Dictionary<CycleStatus, CycleStatus[]> AllowedTransitions = new()
    {
        [CycleStatus.Draft] = [CycleStatus.Active],
        // Active → Draft only when no applicants exist yet (guarded below);
        // used by the wizard's "إلغاء الاعتماد" path to iterate before launch.
        [CycleStatus.Active] = [CycleStatus.Closed, CycleStatus.Draft],
        [CycleStatus.Closed] = [CycleStatus.Archived],
        [CycleStatus.Archived] = [],
    };

    public async Task<CycleDetailDto?> ExecuteAsync(
        Guid id,
        string newStatusStr,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<CycleStatus>(newStatusStr, ignoreCase: true, out var newStatus))
            throw new DomainConflictException(
                $"'{newStatusStr}' is not a valid cycle status.",
                "INVALID_CYCLE_TRANSITION");

        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cycle is null) return null;

        var allowed = AllowedTransitions.GetValueOrDefault(cycle.Status, []);
        if (!allowed.Contains(newStatus))
            throw new DomainConflictException(
                $"Transition {cycle.Status} → {newStatus} is not permitted.",
                "INVALID_CYCLE_TRANSITION");

        if (cycle.Status == CycleStatus.Active && newStatus == CycleStatus.Draft)
        {
            var hasApplicants = await db.Applicants.AsNoTracking()
                .AnyAsync(a => a.CycleId == id, ct);
            if (hasApplicants)
                throw new DomainConflictException(
                    "لا يمكن إلغاء اعتماد الدورة بعد بدء استقبال المتقدمين.",
                    "ACTIVE_HAS_APPLICANTS");
        }

        if (newStatus == CycleStatus.Active)
        {
            // FR-Y03: activation window check
            var now = DateTime.UtcNow;
            if (now < cycle.OpenDate || now > cycle.CloseDate)
                throw new DomainConflictException(
                    "Cycle can only be activated within its open/close date window.",
                    "ACTIVATION_OUT_OF_WINDOW");

            // FR-Y02: single-active invariant
            var hasOtherActive = await db.Cycles
                .AnyAsync(c => c.Id != id
                    && c.Year == cycle.Year
                    && c.Cohort == cycle.Cohort
                    && c.Status == CycleStatus.Active, ct);

            if (hasOtherActive)
                throw new DomainConflictException(
                    "Another cycle is already Active for the same (year, cohort).",
                    "OVERLAPPING_ACTIVE_CYCLE");
        }

        cycle.SetStatus(newStatus);

        // EmitAuditEntries writes the audit row automatically.
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var applicantCount = await db.Applicants.AsNoTracking()
            .CountAsync(a => a.CycleId == id, ct);

        return GetCycleUseCase.MapToDetailDto(cycle, applicantCount);
    }
}
