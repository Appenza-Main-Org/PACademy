using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence;

/// <summary>
/// Automatically promotes wizard_step_statuses rows to in_progress when a
/// wizard-scoped entity is first saved (FR-014), and demotes a complete row
/// back to in_progress when any edit lands on it (symmetric demotion).
/// Runs inside the same transaction as the triggering SaveChangesAsync.
/// </summary>
public sealed class WizardStatusInterceptor : SaveChangesInterceptor
{
    /// <summary>
    /// Maps each wizard entity type to its (cycleId getter, stepKey) pair.
    /// </summary>
    private static readonly Dictionary<Type, (Func<object, Guid> GetCycleId, string StepKey)>
        _wizardEntityMap = new()
        {
            [typeof(CommitteeMergeSplitRule)] = (e => ((CommitteeMergeSplitRule)e).CycleId, "committee_merge_split"),
            [typeof(CommitteeScoreThreshold)] = (e => ((CommitteeScoreThreshold)e).CycleId, "score_thresholds"),
            [typeof(ExamDateConfig)] = (e => ((ExamDateConfig)e).CycleId, "exam_dates"),
            [typeof(TotalScoreConfig)] = (e => ((TotalScoreConfig)e).CycleId, "total_score"),
            [typeof(ElectronicDeclaration)] = (e => ((ElectronicDeclaration)e).CycleId, "electronic_declaration"),
            [typeof(CycleExam)] = (e => ((CycleExam)e).CycleId, "exams"),
        };

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not AdmissionsDbContext db)
            return result;

        var wizardSaves = db.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified
                        && _wizardEntityMap.ContainsKey(e.Entity.GetType()))
            .Select(e => (
                Entity: e.Entity,
                Map: _wizardEntityMap[e.Entity.GetType()]))
            .ToList();

        foreach (var (entity, map) in wizardSaves)
        {
            var cycleId = map.GetCycleId(entity);
            var stepKey = map.StepKey;

            var existing = await db.WizardStepStatuses
                .FindAsync([cycleId, stepKey], cancellationToken);

            if (existing is null)
            {
                db.WizardStepStatuses.Add(WizardStepStatus.CreateInProgress(cycleId, stepKey));
            }
            else
            {
                existing.AutoPromoteToInProgress();
                existing.AutoDemoteFromComplete();
                db.WizardStepStatuses.Update(existing);
            }
        }

        return result;
    }
}
