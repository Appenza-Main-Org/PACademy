using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.Audit;

namespace PACademy.Admin.Api.Persistence;

public sealed class AdminDbContext(DbContextOptions<AdminDbContext> options) : DbContext(options), ILookupsDbContext, IAuditDbContext, IAdmissionsDbContext, IIdentityDbContext, IAdminRecordsDbContext
{
    public DbSet<LookupRowEntity> LookupRows => Set<LookupRowEntity>();
    public DbSet<AuditRowEntity> AuditRows => Set<AuditRowEntity>();
    public DbSet<AdmissionCycleEntity> AdmissionCycles => Set<AdmissionCycleEntity>();
    public DbSet<ApplicantCategoryEntity> ApplicantCategories => Set<ApplicantCategoryEntity>();
    public DbSet<AdmissionRuleEntity> AdmissionRules => Set<AdmissionRuleEntity>();
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<RoleEntity> Roles => Set<RoleEntity>();
    public DbSet<OfficerEntity> Officers => Set<OfficerEntity>();
    public DbSet<AdminRecordEntity> AdminRecords => Set<AdminRecordEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LookupRowEntity>(entity =>
        {
            entity.ToTable("lookup_rows");
            entity.HasKey(x => new { x.LookupKey, x.Code });
            entity.Property(x => x.LookupKey).HasColumnName("lookup_key").HasMaxLength(96).IsRequired();
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(96).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(512).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.LookupKey).HasDatabaseName("ix_lookup_rows_lookup_key");
        });

        modelBuilder.Entity<AuditRowEntity>(entity =>
        {
            entity.ToTable("audit_entries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(96);
            entity.Property(x => x.Action).HasColumnName("action").HasMaxLength(96);
            entity.Property(x => x.Entity).HasColumnName("entity").HasMaxLength(128);
            entity.Property(x => x.EntityId).HasColumnName("entity_id").HasMaxLength(128);
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id").HasMaxLength(128);
            entity.Property(x => x.ActorName).HasColumnName("actor_name").HasMaxLength(256);
            entity.Property(x => x.Details).HasColumnName("details");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<AdmissionCycleEntity>(entity =>
        {
            entity.ToTable("admission_cycles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.NameAr).HasColumnName("name_ar").HasMaxLength(256);
            entity.Property(x => x.Year).HasColumnName("year");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.IsActive).HasDatabaseName("ix_admission_cycles_is_active");
        });

        modelBuilder.Entity<ApplicantCategoryEntity>(entity =>
        {
            entity.ToTable("applicant_categories");
            entity.HasKey(x => x.Key);
            entity.Property(x => x.Key).HasColumnName("key").HasMaxLength(96);
            entity.Property(x => x.LabelAr).HasColumnName("label_ar").HasMaxLength(256);
            entity.Property(x => x.IsOpen).HasColumnName("is_open");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<AdmissionRuleEntity>(entity =>
        {
            entity.ToTable("admission_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.Version }).IsUnique().HasDatabaseName("ux_admission_rules_cycle_version");
        });

        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.FullArabicName).HasColumnName("full_arabic_name").HasMaxLength(256);
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(96);
            entity.Property(x => x.AccountStatus).HasColumnName("account_status").HasMaxLength(48);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.NationalId).IsUnique().HasDatabaseName("ux_users_national_id");
        });

        modelBuilder.Entity<RoleEntity>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Key).HasColumnName("key").HasMaxLength(96);
            entity.Property(x => x.LabelAr).HasColumnName("label_ar").HasMaxLength(256);
            entity.Property(x => x.IsSystem).HasColumnName("is_system");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Key).IsUnique().HasDatabaseName("ux_roles_key");
        });

        modelBuilder.Entity<OfficerEntity>(entity =>
        {
            entity.ToTable("officer_directory");
            entity.HasKey(x => x.NationalId);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.FullArabicName).HasColumnName("full_arabic_name").HasMaxLength(256);
            entity.Property(x => x.OfficerCode).HasColumnName("officer_code").HasMaxLength(64);
            entity.Property(x => x.MobileNumber).HasColumnName("mobile_number").HasMaxLength(32);
            entity.Property(x => x.UserType).HasColumnName("user_type").HasMaxLength(64);
        });

        modelBuilder.Entity<AdminRecordEntity>(entity =>
        {
            entity.ToTable("admin_records");
            entity.HasKey(x => new { x.Module, x.Id });
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(96);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Module).HasDatabaseName("ix_admin_records_module");
        });
    }
}
