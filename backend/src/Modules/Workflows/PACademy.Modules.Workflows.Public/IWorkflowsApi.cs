namespace PACademy.Modules.Workflows.Public;

public interface IWorkflowsApi
{
    /// <summary>
    /// Returns the published workflow for a given category and cycle, or null if none exists.
    /// </summary>
    Task<WorkflowSummaryDto?> GetPublishedAsync(string categoryKey, Guid cycleId, CancellationToken ct = default);

    /// <summary>
    /// Returns true when at least one applicant is currently progressing through the workflow.
    /// Used to guard destructive operations (archive / delete) on a published workflow.
    /// </summary>
    Task<bool> HasInflightApplicantsAsync(Guid workflowId, CancellationToken ct = default);
}

public sealed record WorkflowSummaryDto(
    Guid Id,
    string Name,
    string CategoryKey,
    Guid CycleId,
    IReadOnlyList<WorkflowStageSummaryDto> Stages);

public sealed record WorkflowStageSummaryDto(
    int Order,
    string Kind,
    string PassingCriteria);
