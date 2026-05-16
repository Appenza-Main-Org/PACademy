using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

public sealed class LookupItemConfiguration : IEntityTypeConfiguration<LookupItem>
{
    public void Configure(EntityTypeBuilder<LookupItem> b)
    {
        b.ToTable("lookup_items", t =>
        {
            t.HasCheckConstraint("CK_LookupItem_NotSelfParent", "[parent_id] IS NULL OR [parent_id] <> [id]");
            t.HasCheckConstraint("CK_LookupItem_DateRange", "[start_date] IS NULL OR [end_date] IS NULL OR [start_date] <= [end_date]");
            // Declare DB triggers so EF Core falls back to a trigger-safe
            // SaveChanges path (no OUTPUT INSERTED clause). Triggers are
            // created by migration 010a_LookupMappingsAndTriggers.
            t.HasTrigger("tr_LookupItem_NoCycles");
            t.HasTrigger("tr_LookupItem_BlockDelete");
            t.HasTrigger("tr_LookupItem_FacultyFK");
        });

        b.HasKey(i => i.Id);

        b.Property(i => i.Id).HasColumnName("id");
        b.Property(i => i.LookupTypeCode).HasColumnName("lookup_type_code").HasMaxLength(32).IsRequired();
        b.Property(i => i.Code).HasColumnName("code").HasMaxLength(32).IsRequired();
        b.Property(i => i.NameAr).HasColumnName("name_ar").HasMaxLength(200).IsRequired();
        b.Property(i => i.NameEn).HasColumnName("name_en").HasMaxLength(200);
        b.Property(i => i.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        b.Property(i => i.SortOrder).HasColumnName("sort_order").IsRequired().HasDefaultValue(0);
        b.Property(i => i.ParentId).HasColumnName("parent_id");
        b.Property(i => i.StartDate).HasColumnName("start_date");
        b.Property(i => i.EndDate).HasColumnName("end_date");
        b.Property(i => i.ExtrasJson).HasColumnName("extras").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(i => i.FacultyCode).HasColumnName("faculty_code").HasMaxLength(32);
        b.Property(i => i.DeletedAt).HasColumnName("deleted_at");
        b.Property(i => i.DeletedBy).HasColumnName("deleted_by");
        b.Property(i => i.DeleteReason).HasColumnName("delete_reason").HasMaxLength(500);
        b.Property(i => i.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(i => i.CreatedBy).HasColumnName("created_by").IsRequired();
        b.Property(i => i.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(i => i.UpdatedBy).HasColumnName("updated_by").IsRequired();

        b.Property(i => i.RowVersion)
            .HasColumnName("row_version")
            .IsRowVersion();

        b.HasOne<LookupItemType>()
            .WithMany()
            .HasForeignKey(i => i.LookupTypeCode)
            .HasPrincipalKey(t => t.Code)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne<LookupItem>()
            .WithMany()
            .HasForeignKey(i => i.ParentId)
            .OnDelete(DeleteBehavior.NoAction);

        b.HasIndex(i => new { i.LookupTypeCode, i.Code })
            .HasDatabaseName("UX_LookupItem_TypeCode_Code")
            .IsUnique()
            .HasFilter("[deleted_at] IS NULL");

        b.HasIndex(i => new { i.LookupTypeCode, i.IsActive, i.DeletedAt })
            .HasDatabaseName("IX_LookupItem_Type_Active");

        b.HasIndex(i => new { i.ParentId, i.DeletedAt })
            .HasDatabaseName("IX_LookupItem_Parent");

        b.HasIndex(i => new { i.LookupTypeCode, i.SortOrder, i.CreatedAt })
            .HasDatabaseName("IX_LookupItem_SortOrder");
    }
}
