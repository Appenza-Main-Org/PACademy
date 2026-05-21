using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.CyclesAdmin.Infrastructure;

public sealed class CyclesAdminDbContext(DbContextOptions<CyclesAdminDbContext> options)
    : DbContext(options)
{
    public DbSet<AdminJsonItem> Items => Set<AdminJsonItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var b = modelBuilder.Entity<AdminJsonItem>();
        b.ToTable("admin_cycle_setup_items");
        b.HasKey(x => new { x.Bucket, x.Id });
        b.Property(x => x.Bucket).HasColumnName("bucket").HasMaxLength(80).IsRequired();
        b.Property(x => x.Id).HasColumnName("id").HasMaxLength(120).IsRequired();
        b.Property(x => x.PayloadJson).HasColumnName("payload_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        b.HasIndex(x => new { x.Bucket, x.SortOrder });
    }
}
