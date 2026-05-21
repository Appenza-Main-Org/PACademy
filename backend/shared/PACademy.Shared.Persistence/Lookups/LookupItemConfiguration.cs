using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Shared.Persistence.Lookups;

public sealed class LookupItemConfiguration : IEntityTypeConfiguration<LookupItem>
{
    public void Configure(EntityTypeBuilder<LookupItem> b)
    {
        b.ToTable("admin_lookup_items");
        b.HasKey(x => new { x.LookupKey, x.Code });

        b.Property(x => x.LookupKey).HasColumnName("lookup_key").HasMaxLength(80).IsRequired();
        b.Property(x => x.Code).HasColumnName("code").HasMaxLength(64).IsRequired();
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(240).IsRequired();
        b.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
        b.Property(x => x.PayloadJson).HasColumnName("payload_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasIndex(x => x.LookupKey);
        b.HasIndex(x => new { x.LookupKey, x.SortOrder });
    }
}
