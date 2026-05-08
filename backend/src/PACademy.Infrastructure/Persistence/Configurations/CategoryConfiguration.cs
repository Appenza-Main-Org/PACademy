using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.Categories;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("categories");
        b.HasKey(c => c.Id);
        b.Property(c => c.Key).HasMaxLength(100).IsRequired();
        b.Property(c => c.NameAr).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC_UTF8");
        b.Property(c => c.NameEn).HasMaxLength(200);
        b.Property(c => c.Description).HasMaxLength(1000);
        b.Property(c => c.IsActive).IsRequired();
        b.Property(c => c.CreatedAt).IsRequired();
        b.Property(c => c.Archived).HasDefaultValue(false).IsRequired();
        b.Property(c => c.DemoOrigin).HasDefaultValue(false).IsRequired();

        b.HasIndex(c => c.Key).IsUnique().HasDatabaseName("IX_categories_key");
    }
}
