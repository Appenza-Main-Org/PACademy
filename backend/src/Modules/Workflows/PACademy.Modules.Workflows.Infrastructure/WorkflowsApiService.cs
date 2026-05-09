using PACademy.Modules.Workflows.Infrastructure.Persistence;
using PACademy.Modules.Workflows.Public;

namespace PACademy.Modules.Workflows.Infrastructure;

/// <summary>
/// Phase 5 implementation. GetPublishedAsync is a stub — the Workflow domain
/// entity does not yet have CategoryKey/CycleId/Stages columns. Those will be
/// added when the Admissions-Workflows integration is implemented in Phase 6.
/// </summary>
#pragma warning disable CS9113 // Parameter is unread — stub implementation; db will be used in Phase 6
internal sealed class WorkflowsApiService(WorkflowsDbContext db) : IWorkflowsApi
#pragma warning restore CS9113
{
    public Task<WorkflowSummaryDto?> GetPublishedAsync(
        string categoryKey,
        Guid cycleId,
        CancellationToken ct = default)
    {
        // Stub: CategoryKey and CycleId columns are added in Phase 6
        return Task.FromResult<WorkflowSummaryDto?>(null);
    }

    public Task<bool> HasInflightApplicantsAsync(Guid workflowId, CancellationToken ct = default)
        // Stub — real check added when Admissions module tracks stage progress
        => Task.FromResult(false);
}
