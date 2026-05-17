using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

public sealed class ApplicantCategoryConfigConfiguration : IEntityTypeConfiguration<ApplicantCategoryConfig>
{
    public void Configure(EntityTypeBuilder<ApplicantCategoryConfig> b)
    {
        b.ToTable("applicant_category_configs");

        b.HasKey(c => c.Id);

        b.Property(c => c.Id).HasColumnName("id");
        b.Property(c => c.CategoryId).HasColumnName("category_id").HasMaxLength(64).IsRequired();
        b.Property(c => c.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        b.Property(c => c.SortOrder).HasColumnName("sort_order").IsRequired().HasDefaultValue(0);
        b.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(c => c.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.Property(c => c.RowVersion)
            .HasColumnName("row_version")
            .IsRowVersion();

        b.HasIndex(c => c.CategoryId)
            .HasDatabaseName("UX_AppCatConfig_Category")
            .IsUnique();

        b.HasIndex(c => new { c.SortOrder, c.CreatedAt })
            .HasDatabaseName("IX_AppCatConfig_SortOrder");
    }
}
