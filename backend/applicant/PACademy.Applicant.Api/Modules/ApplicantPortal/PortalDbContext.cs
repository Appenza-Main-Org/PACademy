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
    public DbSet<ApplicantManagementRecordEntity> ApplicantManagementRecords => Set<ApplicantManagementRecordEntity>();
    public DbSet<ExamSlotEntity> ExamSlots => Set<ExamSlotEntity>();
    public DbSet<GeneralSettingsReadEntity> GeneralSettings => Set<GeneralSettingsReadEntity>();
    public DbSet<AcquaintanceDocSettingsEntity> AcquaintanceDocSettings => Set<AcquaintanceDocSettingsEntity>();
    public DbSet<ApplicantAcquaintanceDocEntity> AcquaintanceDocs => Set<ApplicantAcquaintanceDocEntity>();
    public DbSet<ApplicantAcquaintanceDocSectionEntity> AcquaintanceDocSections => Set<ApplicantAcquaintanceDocSectionEntity>();
    public DbSet<ApplicantAcquaintanceDocRevisionEntity> AcquaintanceDocRevisions => Set<ApplicantAcquaintanceDocRevisionEntity>();

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

        modelBuilder.Entity<ApplicantManagementRecordEntity>(entity =>
        {
            entity.ToTable("applicant_management_records");
            entity.HasKey(x => new { x.Module, x.Id });
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(128);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CommitteeId).HasColumnName("committee_id").HasMaxLength(128);
            entity.Property(x => x.CategoryKey).HasColumnName("category_key").HasMaxLength(128);
            entity.Property(x => x.Department).HasColumnName("department").HasMaxLength(128);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(96);
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(96);
            entity.Property(x => x.OccurredAt).HasColumnName("occurred_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_applicant_management_records_applicant_id");
            entity.HasIndex(x => x.NationalId).HasDatabaseName("ix_applicant_management_records_national_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_applicant_management_records_status");
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

        modelBuilder.Entity<GeneralSettingsReadEntity>(entity =>
        {
            entity.ToTable("general_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(64);
            entity.Property(x => x.AcquaintanceDocumentsEntryResponsibleTestCode).HasColumnName("acquaintance_documents_entry_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsOpenTiming).HasColumnName("acquaintance_documents_open_timing").HasMaxLength(48);
            entity.Property(x => x.AcquaintanceDocumentsOpenOffsetValue).HasColumnName("acquaintance_documents_open_offset_value");
            entity.Property(x => x.AcquaintanceDocumentsOpenOffsetUnit).HasColumnName("acquaintance_documents_open_offset_unit").HasMaxLength(16);
            entity.Property(x => x.AcquaintanceDocumentsCloseResponsibleTestCode).HasColumnName("acquaintance_documents_close_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsCloseTiming).HasColumnName("acquaintance_documents_close_timing").HasMaxLength(48);
            entity.Property(x => x.AcquaintanceDocumentsCloseOffsetValue).HasColumnName("acquaintance_documents_close_offset_value");
            entity.Property(x => x.AcquaintanceDocumentsCloseOffsetUnit).HasColumnName("acquaintance_documents_close_offset_unit").HasMaxLength(16);
        });

        modelBuilder.Entity<AcquaintanceDocSettingsEntity>(entity =>
        {
            entity.ToTable("acquaintance_doc_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.OpeningTestKey).HasColumnName("opening_test_key").HasMaxLength(96);
            entity.Property(x => x.OpeningRequiredOutcome).HasColumnName("opening_required_outcome").HasMaxLength(32);
            entity.Property(x => x.ClosingTestKey).HasColumnName("closing_test_key").HasMaxLength(96);
            entity.Property(x => x.ClosingMode).HasColumnName("closing_mode").HasMaxLength(48);
            entity.Property(x => x.ClosingAt).HasColumnName("closing_at");
            entity.Property(x => x.IsEnabled).HasColumnName("is_enabled");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CycleId).IsUnique().HasDatabaseName("ux_acquaintance_doc_settings_cycle_id");
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_docs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(32);
            entity.Property(x => x.OpenedAt).HasColumnName("opened_at");
            entity.Property(x => x.ClosedAt).HasColumnName("closed_at");
            entity.Property(x => x.LastAutosavedAt).HasColumnName("last_autosaved_at");
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.ApplicantId }).IsUnique().HasDatabaseName("ux_applicant_acquaintance_docs_cycle_applicant");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_applicant_acquaintance_docs_applicant_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_applicant_acquaintance_docs_status");
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocSectionEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_doc_sections");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocId).HasColumnName("acquaintance_doc_id").HasMaxLength(96);
            entity.Property(x => x.SectionKey).HasColumnName("section_key").HasMaxLength(64);
            entity.Property(x => x.DataJson).HasColumnName("data_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.AcquaintanceDocId, x.SectionKey }).IsUnique().HasDatabaseName("ux_applicant_acquaintance_doc_sections_doc_section");
            entity.HasOne<ApplicantAcquaintanceDocEntity>()
                .WithMany(x => x.Sections)
                .HasForeignKey(x => x.AcquaintanceDocId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocRevisionEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_doc_revisions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocId).HasColumnName("acquaintance_doc_id").HasMaxLength(96);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.ChangeKind).HasColumnName("change_kind").HasMaxLength(32);
            entity.Property(x => x.ChangedSectionKeysJson).HasColumnName("changed_section_keys_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.AcquaintanceDocId).HasDatabaseName("ix_applicant_acquaintance_doc_revisions_doc_id");
            entity.HasOne<ApplicantAcquaintanceDocEntity>()
                .WithMany()
                .HasForeignKey(x => x.AcquaintanceDocId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
