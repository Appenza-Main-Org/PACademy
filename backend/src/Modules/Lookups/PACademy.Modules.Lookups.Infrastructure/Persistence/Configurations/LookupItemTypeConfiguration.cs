using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

public sealed class LookupItemTypeConfiguration : IEntityTypeConfiguration<LookupItemType>
{
    public void Configure(EntityTypeBuilder<LookupItemType> b)
    {
        b.ToTable("lookup_item_types");
        b.HasKey(t => t.Code);

        b.Property(t => t.Code).HasMaxLength(32).IsRequired();
        b.Property(t => t.LabelAr).HasMaxLength(100).IsRequired();
        b.Property(t => t.CodePrefix).HasMaxLength(8).IsRequired();
        b.Property(t => t.Padding).IsRequired();
        b.Property(t => t.IsHierarchical).IsRequired();
        b.Property(t => t.HasDates).IsRequired();
        b.Property(t => t.HasExtras).IsRequired();
        b.Property(t => t.SectionKey).HasMaxLength(32).IsRequired();
        b.Property(t => t.SortInSection).IsRequired();
        b.Property(t => t.IsAdminUi).IsRequired();

        b.HasIndex(t => t.CodePrefix).IsUnique().HasDatabaseName("UX_LookupItemType_CodePrefix");
    }
}
