using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeMergeSplitRuleConfiguration
    : IEntityTypeConfiguration<CommitteeMergeSplitRule>
{
    public void Configure(EntityTypeBuilder<CommitteeMergeSplitRule> b)
    {
        b.ToTable("committee_merge_split_rules");
        b.HasKey(r => r.Id);

        b.Property(r => r.CycleId).IsRequired();
        b.Property(r => r.Type).HasConversion<string>().HasMaxLength(16).IsRequired();
        b.Property(r => r.SourceCommitteeIdsJson)
            .HasColumnName("SourceCommitteeIds")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("[]");
        b.Property(r => r.TargetCommitteeIdsJson)
            .HasColumnName("TargetCommitteeIds")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("[]");
        b.Property(r => r.Reason).HasMaxLength(500);
        b.Property(r => r.EffectiveAt).IsRequired();
        b.Property(r => r.Status).HasConversion<string>().HasMaxLength(16).IsRequired()
            .HasDefaultValue(MergeSplitStatus.Planned);
        b.Property(r => r.AppliedAt);
        b.Property(r => r.AppliedBy);
        b.Property(r => r.CancelledAt);
        b.Property(r => r.CancelledBy);
        b.Property(r => r.CancelReason).HasMaxLength(500);
        b.Property(r => r.IsArchived).HasDefaultValue(false);
        b.Property(r => r.CreatedAt).IsRequired();
        b.Property(r => r.CreatedBy).IsRequired();
        b.Property(r => r.UpdatedAt).IsRequired();
        b.Property(r => r.RowVersion).IsRowVersion();

        b.HasIndex(r => r.CycleId).HasDatabaseName("IX_merge_split_rules_cycle");
        b.HasIndex(r => new { r.CycleId, r.Status }).HasDatabaseName("IX_merge_split_rules_cycle_status");
    }
}
