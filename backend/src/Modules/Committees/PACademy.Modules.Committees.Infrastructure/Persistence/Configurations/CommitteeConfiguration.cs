using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeConfiguration : IEntityTypeConfiguration<Committee>
{
    public void Configure(EntityTypeBuilder<Committee> b)
    {
        b.ToTable("committees");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired();
        b.Property(x => x.NameEn).HasMaxLength(200);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.DeleteReason).HasMaxLength(500);
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.CycleId, x.Key }).IsUnique()
            .HasFilter("[DeletedAt] IS NULL");
        b.HasIndex(x => x.Status).HasDatabaseName("IX_committees_status");

        b.HasMany(x => x.Members).WithOne().HasForeignKey(m => m.CommitteeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Specializations).WithOne().HasForeignKey(s => s.CommitteeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.DateBindings).WithOne().HasForeignKey(d => d.CommitteeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
