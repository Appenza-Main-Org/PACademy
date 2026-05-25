using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Audit;

public sealed class AuditRowEntity
{
    public required string Id { get; set; }
    public required string Module { get; set; }
    public required string Action { get; set; }
    public required string Entity { get; set; }
    public required string EntityId { get; set; }
    public required string ActorUserId { get; set; }
    public required string ActorName { get; set; }
    public required string Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public interface IAuditDbContext
{
    DbSet<AuditRowEntity> AuditRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
