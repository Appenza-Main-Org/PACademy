using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.WizardStatus;

public sealed class GetWizardStepStatusesUseCase(IAdmissionsDbContext db)
{
    /// <summary>
    /// Canonical 13 step keys per AMENDMENT-001-wizard-step-count.md.
    /// `cycle_metadata` and `marital_status_rules` were removed during the
    /// origin/main merge; `application_settings` step 1 is now owned by spec 011.
    /// </summary>
    private static readonly string[] AllStepKeys =
    [
        "application_settings", "application_status",
        "age_rules", "fees", "exams", "committees",
        "committee_merge_split", "score_thresholds", "exam_dates",
        "date_committee_binding", "total_score", "notifications", "electronic_declaration",
    ];

    public async Task<IReadOnlyList<WizardStepStatusDto>> ExecuteAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var rows = await db.WizardStepStatuses
            .AsNoTracking()
            .Where(w => w.CycleId == cycleId)
            .ToListAsync(ct);

        var lookup = rows.ToDictionary(r => r.StepKey);

        return AllStepKeys.Select(key =>
        {
            if (lookup.TryGetValue(key, out var row))
                return MapDto(row);
            return new WizardStepStatusDto(
                cycleId, key, "not_started", null, null, string.Empty);
        }).ToList();
    }

    internal static WizardStepStatusDto MapDto(WizardStepStatus w)
        => new(w.CycleId, w.StepKey, EnumWireFormat.ToSnakeCase(w.Status),
               w.CompletedAt, w.CompletedBy,
               Convert.ToBase64String(w.RowVersion));
}
