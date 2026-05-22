using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Audit;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class UserEntity
{
    public required string Id { get; set; }
    public required string NationalId { get; set; }
    public required string FullArabicName { get; set; }
    public required string Role { get; set; }
    public required string AccountStatus { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class RoleEntity
{
    public required string Id { get; set; }
    public required string Key { get; set; }
    public required string LabelAr { get; set; }
    public bool IsSystem { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class OfficerEntity
{
    public required string NationalId { get; set; }
    public required string FullArabicName { get; set; }
    public required string OfficerCode { get; set; }
    public required string MobileNumber { get; set; }
    public required string UserType { get; set; }
}

public interface IIdentityDbContext
{
    DbSet<UserEntity> Users { get; }
    DbSet<RoleEntity> Roles { get; }
    DbSet<OfficerEntity> Officers { get; }
    DbSet<AuditRowEntity> AuditRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
