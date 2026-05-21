namespace PACademy.Shared.Audit;

public sealed record AuditEntry(
    string Id,
    string Module,
    string Action,
    string Entity,
    string EntityId,
    string ActorUserId,
    string ActorName,
    string Details,
    DateTimeOffset CreatedAt);

public interface IAuditSink
{
    Task EmitAsync(AuditEntry entry, CancellationToken ct = default);
}

public sealed class NullAuditSink : IAuditSink
{
    public Task EmitAsync(AuditEntry entry, CancellationToken ct = default) => Task.CompletedTask;
}
