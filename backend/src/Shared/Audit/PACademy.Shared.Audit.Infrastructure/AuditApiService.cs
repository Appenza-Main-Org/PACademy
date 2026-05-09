using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Infrastructure.Persistence;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Shared.Audit.Infrastructure;

internal sealed class AuditApiService(AuditDbContext db, ICurrentActor actor) : IAuditApi
{
    public Task RecordAsync(
        AuditAction action, string targetType, Guid targetId, string targetLabel,
        AuditOutcome outcome, string? beforeJson = null, string? afterJson = null,
        CancellationToken ct = default)
    {
        var entry = AuditEntry.Create(
            actor.Id, actor.Name, actor.IpAddress,
            action, targetType, targetId, targetLabel,
            outcome, beforeJson, afterJson);
        db.AuditEntries.Add(entry);
        return Task.CompletedTask;
    }
}
