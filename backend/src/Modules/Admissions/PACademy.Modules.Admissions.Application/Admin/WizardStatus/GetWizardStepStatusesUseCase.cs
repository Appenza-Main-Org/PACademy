using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.WizardStatus;

public sealed class GetWizardStepStatusesUseCase(IAdmissionsDbContext db)
{
    private static readonly string[] AllStepKeys =
    [
        "cycle_metadata", "application_settings", "application_status",
        "age_rules", "marital_status_rules", "fees", "exams", "committees",
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
                cycleId, key, "NotStarted", null, null, string.Empty);
        }).ToList();
    }

    internal static WizardStepStatusDto MapDto(WizardStepStatus w)
        => new(w.CycleId, w.StepKey, w.Status.ToString(),
               w.CompletedAt, w.CompletedBy,
               Convert.ToBase64String(w.RowVersion));
}
