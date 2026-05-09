# Contract: `IWorkflowsApi`

**Project**: `PACademy.Modules.Workflows.Public`
**Source file (target)**: `backend/src/Modules/Workflows/PACademy.Modules.Workflows.Public/IWorkflowsApi.cs`
**Consumed by**: `Admissions.Application` (cycle activation: verify a Published workflow exists per open category); future phases — `Investigations.Application` (case-stage pipelines), `Medical.Application` (station pipelines), `Exams.Application` (exam-stage gates)

```csharp
namespace PACademy.Modules.Workflows.Public;

/// <summary>
/// Read-only intra-process surface for Workflows. DI-only — never exposed over HTTP (FR-M05).
/// </summary>
public interface IWorkflowsApi
{
    /// <summary>
    /// Returns the single Published workflow for a (categoryKey, cycleId) pair, or null if none.
    /// At most one Published workflow exists per pair — see Workflows invariant in data-model.md (spec 004 FR-W02).
    /// Other modules call this when they need the active stage definition for an applicant flow.
    /// </summary>
    Task<WorkflowSummaryDto?> GetPublishedAsync(
        string categoryKey,
        Guid cycleId,
        CancellationToken ct = default);

    /// <summary>
    /// Used by the workflow-reorder use case (spec 004 FR-W05) to block stage reordering on a published
    /// workflow that has applicants mid-stream. Phase 5 keeps the implementation inside the Workflows
    /// module (Admissions doesn't track applicant-workflow progress yet); the surface is here so future
    /// phases can implement it as a cross-module check.
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
```

## Behaviour notes

- `GetPublishedAsync` returns the workflow with its stages eagerly loaded (single SQL with JOIN). Callers don't pay an N+1.
- Stages are ordered by `Order` ASC; the contract guarantees contiguous 1-based ordering (enforced by the validator inside the Workflows module).
- `Kind` is one of the canonical `RequiredTestKind` values: `aptitude`, `posture`, `medical`, `physical`, `psychological`, `interview`, `drug`, `security_review`, `tactical_training`, `security_training`, `specialized_courses`. Frontend types align.
- Publish-with-auto-archive (FR-W02 spec 004) stays inside `WorkflowsDbContext` as a single-context Serializable transaction (FR-W04 spec 005) — no `CrossModuleUnitOfWork` needed for that path.
- Admin CRUD over workflows lives behind `AdminWorkflowsController` in `PACademy.Api/Controllers/`, which calls into `Workflows.Application` use cases directly. The HTTP surface is unchanged from spec 004; only the assembly the controller's dependencies live in changes.
