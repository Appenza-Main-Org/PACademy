using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.AdminRecords;

/// <summary>
/// Legacy table mapping kept only so migrations and one-way drains can read
/// historical rows. New feature storage must use a normalized domain table;
/// operational compatibility rows use domain-owned tables. Do not add write
/// paths here.
/// </summary>
[Obsolete("admin_records is legacy migration-only storage. New features must use normalized tables.", error: false)]
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
