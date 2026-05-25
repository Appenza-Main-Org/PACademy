using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Modules.Audit;

public sealed class DbAuditSink(IAuditDbContext db) : IAuditSink
{
    public async Task EmitAsync(AuditEntry entry, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        db.AuditRows.Add(new AuditRowEntity
        {
            Id = entry.Id,
            Module = entry.Module,
            Action = entry.Action,
            Entity = entry.Entity,
            EntityId = entry.EntityId,
            ActorUserId = entry.ActorUserId,
            ActorName = entry.ActorName,
            Details = entry.Details,
            CreatedAt = entry.CreatedAt,
            UpdatedAt = now
        });
        await db.SaveChangesAsync(ct);
    }
}
