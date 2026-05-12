using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Audit.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.WizardStatus;

public sealed class CompleteWizardStepUseCase(
    IAdmissionsDbContext db,
    IIdentityApi identity,
    IAuditApi audit)
{
    public async Task<WizardStepStatusDto> ExecuteAsync(
        Guid cycleId, string stepKey, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var row = await db.WizardStepStatuses
            .FirstOrDefaultAsync(w => w.CycleId == cycleId && w.StepKey == stepKey, ct);

        if (row is null)
        {
            row = WizardStepStatus.CreateInProgress(cycleId, stepKey);
            db.WizardStepStatuses.Add(row);
        }

        row.MarkComplete(actor.Id);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditAction.Update, "wizard_step_status", row.CycleId,
            $"{stepKey} marked complete", AuditOutcome.Success);

        return GetWizardStepStatusesUseCase.MapDto(row);
    }
}
