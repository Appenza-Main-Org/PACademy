using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class AdmissionRuleConfiguration : IEntityTypeConfiguration<AdmissionRule>
{
    public void Configure(EntityTypeBuilder<AdmissionRule> b)
    {
        b.ToTable("admission_rules");
        b.HasKey(r => r.Id);

        b.Property(r => r.Name).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(r => r.Description).HasMaxLength(1000);
        b.Property(r => r.CycleId);
        b.Property(r => r.Version).HasDefaultValue(1).IsRequired();
        b.Property(r => r.EffectiveAt).IsRequired();
        b.Property(r => r.ChangedById).IsRequired();
        b.Property(r => r.RulesJson).HasColumnName("Rules").HasColumnType("nvarchar(max)").HasDefaultValue("{}");
        b.Property(r => r.IsActive).IsRequired();
        b.Property(r => r.CreatedAt).IsRequired();
        b.Property(r => r.UpdatedAt).IsRequired();
        b.Property(r => r.Archived).HasDefaultValue(false).IsRequired();
        b.Property(r => r.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.Property(r => r.RowVersion).IsRowVersion();

        b.HasIndex(r => new { r.CycleId, r.Version })
            .IsUnique()
            .HasFilter("[CycleId] IS NOT NULL")
            .HasDatabaseName("IX_admission_rules_cycle_version");
    }
}
