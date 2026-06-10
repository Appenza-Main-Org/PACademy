namespace PACademy.Admin.Api.Modules.Workflows;

/// <summary>
/// Normalized "Shape A" tables for department workflows and per-applicant
/// progress, extracted from the JSON <c>workflow_records</c> buckets
/// (<c>workflows</c> / <c>applicantWorkflowProgress</c>; the append-only
/// <c>workflowTransitions</c> log intentionally stays JSON).
///
/// House mirror strategy: typed columns own query/index/integrity;
/// <c>PayloadJson</c> keeps the full DTO verbatim. The 3-variant
/// <c>passCriterion</c> union and scalar <c>allowedNextStatuses[]</c>
/// stay as JSON columns (no query value as tables).
/// </summary>
public sealed class WorkflowEntity
{
    public required string Id { get; set; }
    public string? Department { get; set; }
    public string? Name { get; set; }
    public string? CycleId { get; set; }
    public bool IsActive { get; set; }
    public int Version { get; set; }
    public string? UpdatedBy { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<WorkflowStageEntity> Stages { get; set; } = [];
    public List<WorkflowStageTestEntity> Tests { get; set; } = [];
}

/// <summary>One ordered stage of a workflow (<c>stages[]</c>).</summary>
public sealed class WorkflowStageEntity
{
    public required string WorkflowId { get; set; }
    public int StageOrder { get; set; }
    public required string StageId { get; set; }
    public string? Name { get; set; }
    public string? StatusOnEnter { get; set; }
    /// <summary>string[] kept as JSON — scalar list, no query value as rows.</summary>
    public string? AllowedNextStatusesJson { get; set; }
}

/// <summary>One ordered test inside a workflow stage (<c>stages[].tests[]</c>).
/// FK to the aggregate root (workflow), keyed by stage_id so tests survive
/// stage reordering — mirrors the exams/rules precedent.</summary>
public sealed class WorkflowStageTestEntity
{
    public required string WorkflowId { get; set; }
    public required string StageId { get; set; }
    public int TestOrder { get; set; }
    public string? TestId { get; set; }
    public string? Name { get; set; }
    public string? Kind { get; set; }
    public bool Required { get; set; }
    /// <summary>Discriminated union kept as JSON.</summary>
    public string? PassCriterionJson { get; set; }
    public string? OwnerApp { get; set; }
}

/// <summary>Bucket <c>applicantWorkflowProgress</c> — one row per applicant per
/// workflow. PK is the record id (= applicant id in practice) to keep the
/// OperationalRecordsService seam uniform.</summary>
public sealed class ApplicantWorkflowProgressEntity
{
    public required string Id { get; set; }
    public string? ApplicantId { get; set; }
    public string? WorkflowId { get; set; }
    public int WorkflowVersion { get; set; }
    public string? CurrentStageId { get; set; }
    /// <summary>string[] kept as JSON — scalar list.</summary>
    public string? CompletedStageIdsJson { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<ApplicantWorkflowTestResultEntity> TestResults { get; set; } = [];
}

/// <summary>One recorded test outcome of an applicant's progress (<c>testResults[]</c>).</summary>
public sealed class ApplicantWorkflowTestResultEntity
{
    public required string ProgressId { get; set; }
    public required string StageId { get; set; }
    public required string TestId { get; set; }
    public string? Outcome { get; set; }
    public decimal? Score { get; set; }
    public DateTimeOffset? RecordedAt { get; set; }
    public string? RecordedBy { get; set; }
}
