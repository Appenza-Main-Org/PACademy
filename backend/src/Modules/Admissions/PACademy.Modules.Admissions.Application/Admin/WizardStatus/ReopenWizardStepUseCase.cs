using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Audit.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.WizardStatus;

public sealed class ReopenWizardStepUseCase(IAdmissionsDbContext db, IAuditApi audit)
{
    public async Task<WizardStepStatusDto?> ExecuteAsync(
        Guid cycleId, string stepKey, CancellationToken ct = default)
    {
        var row = await db.WizardStepStatuses
            .FirstOrDefaultAsync(w => w.CycleId == cycleId && w.StepKey == stepKey, ct);
        if (row is null) return null;

        row.Reopen();
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditAction.Update, "wizard_step_status", row.CycleId,
            $"{stepKey} reopened", AuditOutcome.Success);

        return GetWizardStepStatusesUseCase.MapDto(row);
    }
}
