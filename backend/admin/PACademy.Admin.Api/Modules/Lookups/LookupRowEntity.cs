using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed class LookupRowEntity
{
    public required string LookupKey { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public interface ILookupsDbContext
{
    DbSet<LookupRowEntity> LookupRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
