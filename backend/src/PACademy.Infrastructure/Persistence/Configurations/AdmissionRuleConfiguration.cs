using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.AdmissionRules;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class AdmissionRuleConfiguration : IEntityTypeConfiguration<AdmissionRule>
{
    public void Configure(EntityTypeBuilder<AdmissionRule> b)
    {
        b.ToTable("admission_rules");
        b.HasKey(r => r.Id);
        b.Property(r => r.Name).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC_UTF8");
        b.Property(r => r.Description).HasMaxLength(1000);
        b.Property(r => r.RulesJson).HasColumnType("nvarchar(max)");
        b.Property(r => r.IsActive).IsRequired();
        b.Property(r => r.CreatedAt).IsRequired();
        b.Property(r => r.UpdatedAt).IsRequired();
        b.Property(r => r.Archived).HasDefaultValue(false).IsRequired();
        b.Property(r => r.DemoOrigin).HasDefaultValue(false).IsRequired();
    }
}
