using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionCycleEntity
{
    public required string Id { get; set; }
    public required string NameAr { get; set; }
    public int Year { get; set; }
    public required string Status { get; set; }
    public bool IsActive { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ApplicantCategoryEntity
{
    public required string Key { get; set; }
    public required string LabelAr { get; set; }
    public bool IsOpen { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class AdmissionRuleEntity
{
    public required string Id { get; set; }
    public required string CycleId { get; set; }
    public int Version { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public interface IAdmissionsDbContext
{
    DbSet<AdmissionCycleEntity> AdmissionCycles { get; }
    DbSet<ApplicantCategoryEntity> ApplicantCategories { get; }
    DbSet<AdmissionRuleEntity> AdmissionRules { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
