using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordEntity
{
    public required string Module { get; set; }
    public required string Id { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public interface IAdminRecordsDbContext
{
    DbSet<AdminRecordEntity> AdminRecords { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
