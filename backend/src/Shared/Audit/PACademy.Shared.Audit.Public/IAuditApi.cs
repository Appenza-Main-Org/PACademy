using PACademy.Shared.Audit.Domain;

namespace PACademy.Shared.Audit.Public;

public interface IAuditApi
{
    Task RecordAsync(
        AuditAction action, string targetType, Guid targetId, string targetLabel,
        AuditOutcome outcome, string? beforeJson = null, string? afterJson = null,
        CancellationToken ct = default);
}
