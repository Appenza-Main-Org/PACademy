using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Audit.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

/// <summary>
/// Read-only mapping of the shared audit_entries table into this DbContext so that
/// GetApplicantUseCase can look up the actor name from the audit log.
/// No migrations are driven from this context — migrations are owned by the
/// Shared.Audit.Infrastructure context.
/// </summary>
internal sealed class AuditEntryReadConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> b)
    {
        b.ToTable("audit_entries");
        b.HasKey(a => a.Id);

        // Do NOT drive migrations from this context — audit_entries is owned by
        // PACademy.Shared.Audit.Infrastructure. Exclude so Add-Migration produces
        // no DDL for this table.
        b.ToTable(t => t.ExcludeFromMigrations());
        b.Property(a => a.ActorId).IsRequired();
        b.Property(a => a.ActorName).HasMaxLength(200).IsRequired();
        b.Property(a => a.ActorIp).HasMaxLength(45).IsRequired();
        b.Property(a => a.Action).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(a => a.TargetType).HasMaxLength(100).IsRequired();
        b.Property(a => a.TargetId).IsRequired();
        b.Property(a => a.TargetLabel).HasMaxLength(300).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(a => a.Outcome).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(a => a.BeforeJson).HasColumnType("nvarchar(max)");
        b.Property(a => a.AfterJson).HasColumnType("nvarchar(max)");
        b.Property(a => a.OccurredAt).IsRequired();
        b.Property(a => a.DemoOrigin).HasDefaultValue(false).IsRequired();

        b.HasOne(a => a.Batch)
            .WithMany(a => a.Children)
            .HasForeignKey(a => a.BatchId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);
    }
}
