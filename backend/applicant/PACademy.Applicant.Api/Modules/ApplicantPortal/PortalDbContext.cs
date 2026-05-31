using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

/// <summary>
/// Read-write DbContext for the applicant portal tables.
/// Migrations are owned by the admin backend's AdminDbContext — this
/// context has no MigrationsAssembly so a stray 'dotnet ef' command here
/// is a no-op.
/// Schema is read from Database:Schema config key (mirrors admin backend convention).
/// </summary>
public sealed class PortalDbContext(DbContextOptions<PortalDbContext> options, IConfiguration configuration)
    : DbContext(options)
{
    private string Schema => configuration["Database:Schema"] ?? "dbo";

    public DbSet<ApplicantPortalRecordEntity> PortalRecords => Set<ApplicantPortalRecordEntity>();
    public DbSet<ExamSlotEntity> ExamSlots => Set<ExamSlotEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<ApplicantPortalRecordEntity>(entity =>
        {
            entity.ToTable("applicant_portal_records");
            entity.HasKey(x => new { x.Type, x.RecordId });
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(64);
            entity.Property(x => x.RecordId).HasColumnName("record_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<ExamSlotEntity>(entity =>
        {
            entity.ToTable("exam_slots");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(64);
            entity.Property(x => x.Date).HasColumnName("date");
            entity.Property(x => x.Time).HasColumnName("time").HasMaxLength(16);
            entity.Property(x => x.Location).HasColumnName("location").HasMaxLength(512);
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.Reserved).HasColumnName("reserved");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });
    }
}
