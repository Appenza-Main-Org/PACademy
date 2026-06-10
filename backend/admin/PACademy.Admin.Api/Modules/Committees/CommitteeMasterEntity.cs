namespace PACademy.Admin.Api.Modules.Committees;

/// <summary>
/// Normalized "Shape A" table for committee definitions, extracted from the JSON
/// <c>committee_records</c> bucket (<c>module = 'committees'</c>).
///
/// House mirror strategy: typed columns own query/index/integrity;
/// <see cref="PayloadJson"/> keeps the full DTO verbatim (wire DTO:
/// <c>Committee</c>/<c>CommitteeRow</c>, frontend committees feature).
/// The nested <c>rules</c>/<c>scoreCriteria</c> value-objects and the scalar
/// <c>scoped*Ids[]</c>/<c>linked*Ids[]</c> selection arrays stay inside the
/// payload — they are admin-side pick-lists with no backend join usage, so
/// child tables would be over-normalization (per the value-object rule).
/// </summary>
public sealed class CommitteeMasterEntity
{
    public required string Id { get; set; }
    public string? Name { get; set; }
    public string? CategoryKey { get; set; }
    public string? GradeType { get; set; }
    public decimal? GradeMin { get; set; }
    public decimal? GradeMax { get; set; }
    public int Capacity { get; set; }
    public string? Gender { get; set; }
    public string? Status { get; set; }
    public string? HeadUserId { get; set; }
    public string? AcademicYearId { get; set; }
    public string? LinkedCycleId { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
