using PACademy.Domain.Audit;

namespace PACademy.Application.Audit;

public interface IAuditWriter
{
    /// <summary>Records a single audit entry.</summary>
    Task RecordAsync(
        AuditAction action,
        string targetType,
        Guid targetId,
        string targetLabel,
        AuditOutcome outcome,
        string? beforeJson = null,
        string? afterJson = null,
        CancellationToken ct = default);

    /// <summary>
    /// Bulk overload for large import operations (plan §10 / FR-028).
    /// Writes a summary entry plus per-row children via SqlBulkCopy.
    /// </summary>
    Task RecordBulkAsync(
        AuditEntry summary,
        IReadOnlyList<AuditEntry> children,
        CancellationToken ct = default);
}
