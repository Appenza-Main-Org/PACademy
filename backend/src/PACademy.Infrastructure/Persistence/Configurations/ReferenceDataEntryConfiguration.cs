using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.ReferenceData;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class ReferenceDataEntryConfiguration : IEntityTypeConfiguration<ReferenceDataEntry>
{
    public void Configure(EntityTypeBuilder<ReferenceDataEntry> b)
    {
        b.ToTable("reference_data_entries");
        b.HasKey(r => r.Id);
        b.Property(r => r.Category).HasMaxLength(100).IsRequired();
        b.Property(r => r.Key).HasMaxLength(100).IsRequired();
        b.Property(r => r.NameAr).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC_UTF8");
        b.Property(r => r.NameEn).HasMaxLength(200);
        b.Property(r => r.Metadata).HasColumnType("nvarchar(max)");
        b.Property(r => r.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(r => r.IsActive).IsRequired();
        b.Property(r => r.CreatedAt).IsRequired();
        b.Property(r => r.Archived).HasDefaultValue(false).IsRequired();
        b.Property(r => r.DemoOrigin).HasDefaultValue(false).IsRequired();

        b.HasIndex(r => new { r.Category, r.Key })
            .IsUnique()
            .HasDatabaseName("IX_reference_data_category_key");

        b.HasIndex(r => new { r.Category, r.SortOrder })
            .HasDatabaseName("IX_reference_data_category_sort");
    }
}
