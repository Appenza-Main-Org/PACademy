namespace PACademy.Admin.Api.Modules.Exams;

/// <summary>
/// Normalized "Shape A" tables for exam operational master data, extracted from the
/// JSON <c>exam_operational_records</c> buckets. House mirror strategy: typed columns
/// own query/index/integrity; <c>PayloadJson</c> keeps the full DTO verbatim so the
/// read path returns the identical wire shape. The log/cache buckets in the same
/// operational table (<c>exam-audit</c>, <c>exam-attempts</c>, <c>exam-live-sessions</c>)
/// intentionally stay JSON.
/// </summary>

/// <summary>Bucket <c>exam-committee-users</c> — exam-room operator accounts.
/// Wire DTO: <c>ExamCommitteeUser</c> (frontend exams feature). The raw password
/// stays inside the payload (masked on read by <c>ExamsService.MaskUser</c>).</summary>
public sealed class ExamCommitteeUserEntity
{
    public required string Id { get; set; }
    public string? FullName { get; set; }
    public string? Username { get; set; }
    public string? Permission { get; set; }
    public string? ExamType { get; set; }
    public string? Status { get; set; }
    public string? AuthorizedDeviceId { get; set; }
    public string? AuthorizedIp { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

/// <summary>Bucket <c>exam-devices</c> — authorized exam-room devices.
/// Wire DTO: <c>ExamAuthorizedDevice</c>.</summary>
public sealed class ExamDeviceEntity
{
    public required string Id { get; set; }
    public string? Label { get; set; }
    public string? MacAddress { get; set; }
    public string? IpAddress { get; set; }
    public string? Status { get; set; }
    public string? AllowedFrom { get; set; }
    public string? AllowedTo { get; set; }
    public string? ExamId { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

/// <summary>Bucket <c>examPlans</c> — per-cycle, per-category exam ordering
/// (see <c>ExamPlansController</c>). The <c>exams[]</c> entries become child rows.</summary>
public sealed class ExamPlanEntity
{
    public required string Id { get; set; }
    public string? CycleId { get; set; }
    public string? CategoryId { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<ExamPlanExamEntity> Exams { get; set; } = [];
}

/// <summary>One ordered exam of a plan (<c>exams[]</c>).</summary>
public sealed class ExamPlanExamEntity
{
    public required string PlanId { get; set; }
    public int ExamOrder { get; set; }
    public string? ExamId { get; set; }
    public decimal? Fee { get; set; }
    public bool IsRequired { get; set; }
}

/// <summary>Bucket <c>exam-results</c> (Question Bank result approve/publish lifecycle,
/// <c>ExamsService.ResultsModule</c>) — one row per graded attempt. Distinct from the
/// <c>examResults</c> bucket below (different writers, different id-space). This bucket
/// was never routed by <c>BucketFor</c> and lived in legacy <c>admin_records</c>.</summary>
public sealed class ExamAttemptResultEntity
{
    public required string Id { get; set; }
    public string? ExamId { get; set; }
    public string? AttemptId { get; set; }
    public string? ApplicantId { get; set; }
    public string? Status { get; set; }
    public string? PassFail { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

/// <summary>Bucket <c>examResults</c> — per-applicant exam result rows
/// (device callbacks + manual entry + bulk upload, see <c>ExamPlansController</c>).
/// Only the stable envelope is typed; score fields vary by device and live in the payload.</summary>
public sealed class ExamResultEntity
{
    public required string Id { get; set; }
    public string? CycleId { get; set; }
    public string? ExamId { get; set; }
    public string? ApplicantId { get; set; }
    public string? NationalId { get; set; }
    public string? Status { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
