using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class CycleConfiguration : IEntityTypeConfiguration<Cycle>
{
    public void Configure(EntityTypeBuilder<Cycle> b)
    {
        b.ToTable("cycles");
        b.HasKey(c => c.Id);

        b.Property(c => c.NameAr).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(c => c.Year).IsRequired();
        b.Property(c => c.Cohort).HasMaxLength(8).IsRequired();
        b.Property(c => c.ExpectedCapacity).IsRequired();
        b.Property(c => c.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(c => c.OpenDate).IsRequired();
        b.Property(c => c.CloseDate).IsRequired();
        b.Property(c => c.CreatedAt).IsRequired();
        b.Property(c => c.UpdatedAt).IsRequired();
        b.Property(c => c.Archived).HasDefaultValue(false).IsRequired();
        b.Property(c => c.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.Property(c => c.OpenCategoriesJson)
            .HasColumnName("OpenCategories")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("{}");
        b.Property(c => c.ConditionOverridesJson)
            .HasColumnName("ConditionOverrides")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("{}");

        b.HasIndex(c => c.Archived)
            .HasFilter("[Archived] = 0")
            .HasDatabaseName("IX_cycles_active");

        b.HasIndex(c => new { c.Year, c.Cohort })
            .HasFilter("[Status] = N'Active'")
            .IsUnique()
            .HasDatabaseName("IX_cycles_year_cohort_active");
    }
}
