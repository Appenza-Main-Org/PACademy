using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Audit.Domain;

namespace PACademy.Shared.Audit.Infrastructure.Persistence;

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> b)
    {
        b.ToTable("audit_entries");
        b.HasKey(a => a.Id);
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

        // Self-referencing FK for bulk-op children (plan research §9)
        b.HasOne(a => a.Batch)
            .WithMany(a => a.Children)
            .HasForeignKey(a => a.BatchId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // Composite indexes for audit log queries (FR-008)
        b.HasIndex(a => new { a.TargetType, a.TargetId, a.OccurredAt })
            .HasDatabaseName("IX_audit_entries_target");
        b.HasIndex(a => new { a.ActorId, a.OccurredAt })
            .HasDatabaseName("IX_audit_entries_actor");
        b.HasIndex(a => a.BatchId)
            .HasDatabaseName("IX_audit_entries_batch_id");
    }
}
