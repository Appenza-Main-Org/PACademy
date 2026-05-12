using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeScoreThresholdConfiguration
    : IEntityTypeConfiguration<CommitteeScoreThreshold>
{
    public void Configure(EntityTypeBuilder<CommitteeScoreThreshold> b)
    {
        b.ToTable("committee_score_thresholds");
        b.HasKey(t => new { t.CycleId, t.CommitteeId });

        b.Property(t => t.CycleId).IsRequired();
        b.Property(t => t.CommitteeId).IsRequired();
        b.Property(t => t.Min).IsRequired();
        b.Property(t => t.Max).IsRequired();
        b.Property(t => t.UpdatedAt).IsRequired();
        b.Property(t => t.UpdatedBy).IsRequired();
        b.Property(t => t.RowVersion).IsRowVersion();

        b.HasIndex(t => t.CycleId).HasDatabaseName("IX_score_thresholds_cycle");
    }
}
