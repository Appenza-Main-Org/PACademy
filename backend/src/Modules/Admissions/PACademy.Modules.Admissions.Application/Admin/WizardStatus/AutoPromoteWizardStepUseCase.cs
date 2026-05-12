using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.WizardStatus;

/// <summary>
/// Cross-spec auto-promote hook (spec 009 T047a).
///
/// The <see cref="Persistence.WizardStatusInterceptor"/> auto-promotes
/// <c>not_started → in_progress</c> when any spec-009 wizard entity is saved
/// inside <c>AdmissionsDbContext</c>. Spec 011's application-settings tables
/// live in a *different* DbContext (<c>LookupsDbContext</c>), so the
/// interceptor never sees them. This use case is the explicit RPC that spec
/// 011's frontend service calls on first save per cycle to flip the pill
/// for the <c>application_settings</c> step.
///
/// Idempotent: no-op when the row is already <c>InProgress</c> or
/// <c>Complete</c>. No audit emission (the spec-011 mutation that triggered
/// the call already audits its own change).
/// </summary>
public sealed class AutoPromoteWizardStepUseCase(IAdmissionsDbContext db)
{
    public async Task<WizardStepStatusDto> ExecuteAsync(
        Guid cycleId, string stepKey, CancellationToken ct = default)
    {
        var row = await db.WizardStepStatuses
            .FirstOrDefaultAsync(w => w.CycleId == cycleId && w.StepKey == stepKey, ct);

        if (row is null)
        {
            row = WizardStepStatus.CreateInProgress(cycleId, stepKey);
            db.WizardStepStatuses.Add(row);
            await db.SaveChangesAsync(ct);
        }
        // Already in_progress or complete → no-op; do not auto-demote complete

        return GetWizardStepStatusesUseCase.MapDto(row);
    }
}
