using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public sealed class AdminRecordDocumentEntity : IChangeTracked
{
    public required string Module { get; set; }
    public required string Id { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public interface IAdminRecordDocumentsDbContext
{
    DbSet<AdminRecordDocumentEntity> AdminRecordDocuments { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
