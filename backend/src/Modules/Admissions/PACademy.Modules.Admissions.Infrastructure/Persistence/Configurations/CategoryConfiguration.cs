using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("categories");
        b.HasKey(c => c.Id);

        b.Property(c => c.Key).HasMaxLength(100).IsRequired();
        b.Property(c => c.NameAr).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(c => c.NameEn).HasMaxLength(200);
        b.Property(c => c.Description).HasMaxLength(1000);
        b.Property(c => c.ConditionsJson).HasColumnName("Conditions").HasColumnType("nvarchar(max)").HasDefaultValue("{}");
        b.Property(c => c.RequiredTestsJson).HasColumnName("RequiredTests").HasColumnType("nvarchar(max)").HasDefaultValue("[]");
        b.Property(c => c.ProceduresJson).HasColumnName("Procedures").HasColumnType("nvarchar(max)").HasDefaultValue("[]");
        b.Property(c => c.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(c => c.IsActive).IsRequired();
        b.Property(c => c.IsSpec).HasDefaultValue(false).IsRequired();
        b.Property(c => c.CreatedAt).IsRequired();
        b.Property(c => c.UpdatedAt).IsRequired();
        b.Property(c => c.Archived).HasDefaultValue(false).IsRequired();
        b.Property(c => c.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.Property(c => c.RowVersion).IsRowVersion();

        b.HasIndex(c => c.Key).IsUnique().HasDatabaseName("IX_categories_key");
    }
}
