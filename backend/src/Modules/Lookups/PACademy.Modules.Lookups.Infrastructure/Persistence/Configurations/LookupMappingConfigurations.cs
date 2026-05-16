using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

internal static class LookupMappingTables
{
    internal static void ConfigureMapping<T>(EntityTypeBuilder<T> b, string tableName, string pkName, string triggerName)
        where T : LookupMapping
    {
        b.ToTable(tableName, t => t.HasTrigger(triggerName));
        b.HasKey(m => new { m.CategoryId, m.TargetId }).HasName(pkName);

        b.Property(m => m.CategoryId).HasColumnName("category_id");
        b.Property(m => m.TargetId).HasColumnName("target_id");
        b.Property(m => m.SortOrder).HasColumnName("sort_order").HasDefaultValue(0);
        b.Property(m => m.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(m => m.CreatedBy).HasColumnName("created_by").IsRequired();
        b.Property(m => m.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasOne<LookupItem>()
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.NoAction);

        b.HasOne<LookupItem>()
            .WithMany()
            .HasForeignKey(m => m.TargetId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class CategorySpecializationConfiguration : IEntityTypeConfiguration<CategorySpecialization>
{
    public void Configure(EntityTypeBuilder<CategorySpecialization> b)
        => LookupMappingTables.ConfigureMapping(b, "category_specializations", "PK_CategorySpecializations", "tr_CategorySpecializations_ValidateRefs");
}

public sealed class CategoryCommitteeConfiguration : IEntityTypeConfiguration<CategoryCommittee>
{
    public void Configure(EntityTypeBuilder<CategoryCommittee> b)
        => LookupMappingTables.ConfigureMapping(b, "category_committees", "PK_CategoryCommittees", "tr_CategoryCommittees_ValidateRefs");
}

public sealed class CategoryTestConfiguration : IEntityTypeConfiguration<CategoryTest>
{
    public void Configure(EntityTypeBuilder<CategoryTest> b)
        => LookupMappingTables.ConfigureMapping(b, "category_tests", "PK_CategoryTests", "tr_CategoryTests_ValidateRefs");
}

public sealed class PeriodCategoryConfiguration : IEntityTypeConfiguration<PeriodCategory>
{
    public void Configure(EntityTypeBuilder<PeriodCategory> b)
        => LookupMappingTables.ConfigureMapping(b, "period_categories", "PK_PeriodCategories", "tr_PeriodCategories_ValidateRefs");
}
