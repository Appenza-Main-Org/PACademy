using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class TotalScoreConfigConfiguration : IEntityTypeConfiguration<TotalScoreConfig>
{
    public void Configure(EntityTypeBuilder<TotalScoreConfig> b)
    {
        b.ToTable("total_score_configs");
        b.HasKey(t => t.Id);

        b.Property(t => t.CycleId).IsRequired();
        b.Property(t => t.ApplicantStream).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(t => t.ComponentsJson)
            .HasColumnName("Components")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("[]");
        b.Property(t => t.TotalScoreOutOf).IsRequired();
        b.Property(t => t.UpdatedAt).IsRequired();
        b.Property(t => t.UpdatedBy).IsRequired();
        b.Property(t => t.RowVersion).IsRowVersion();

        b.HasIndex(t => new { t.CycleId, t.ApplicantStream })
            .IsUnique()
            .HasDatabaseName("IX_total_score_configs_cycle_stream");
    }
}
