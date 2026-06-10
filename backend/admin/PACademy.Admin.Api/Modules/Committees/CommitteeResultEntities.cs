namespace PACademy.Admin.Api.Modules.Committees;

/// <summary>
/// Normalized "Shape A" tables for committee evaluation results, extracted from
/// the JSON <c>committee_records</c> bucket (<c>module = 'committeeResults'</c>).
/// House mirror strategy: typed columns own query/index/integrity;
/// <c>PayloadJson</c> keeps the full DTO verbatim. The <c>scores</c> map becomes
/// child rows so per-criterion scores are queryable.
/// </summary>
public sealed class CommitteeResultEntity
{
    public required string Id { get; set; }
    public string? CommitteeId { get; set; }
    public string? ApplicantId { get; set; }
    public string? Phase { get; set; }
    public string? PassFail { get; set; }
    public string? EnteredBy { get; set; }
    public DateTimeOffset? EnteredAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<CommitteeResultScoreEntity> Scores { get; set; } = [];
}

/// <summary>One entry of a result's <c>scores</c> map (criterion key → numeric score).</summary>
public sealed class CommitteeResultScoreEntity
{
    public required string ResultId { get; set; }
    public required string ScoreKey { get; set; }
    public decimal ScoreValue { get; set; }
}
