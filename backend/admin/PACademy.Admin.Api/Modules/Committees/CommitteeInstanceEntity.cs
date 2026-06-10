namespace PACademy.Admin.Api.Modules.Committees;

/// <summary>
/// Normalized "Shape A" table for a committee exam-config instance (one row per
/// committee definition × cycle × date). Extracted from the JSON
/// <c>committee_records</c> bucket (<c>module = 'committeeInstances'</c>).
///
/// Follows the house mirror strategy: every field is a typed/indexed column that
/// owns query + integrity, and <see cref="PayloadJson"/> keeps the full DTO
/// verbatim so the read path returns the exact same wire shape the frontend
/// already consumes (see <c>OperationalRecordsService</c> normalized switch).
///
/// Wire DTO: <c>frontend/src/shared/types/domain.ts › CommitteeInstance</c>.
/// </summary>
public sealed class CommitteeInstanceEntity
{
    public required string Id { get; set; }
    public required string DefinitionCode { get; set; }
    public required string CycleId { get; set; }
    public required string CategoryKey { get; set; }
    /// <summary>ISO yyyy-mm-dd the instance sits on.</summary>
    public DateOnly Date { get; set; }
    public int Capacity { get; set; }
    public int Reserved { get; set; }
    /// <summary>Last time <see cref="Reserved"/> was synced from scheduling; null until first refresh.</summary>
    public DateTimeOffset? ReservedRefreshedAt { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
