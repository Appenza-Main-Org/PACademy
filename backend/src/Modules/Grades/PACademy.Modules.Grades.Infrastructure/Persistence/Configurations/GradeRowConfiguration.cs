using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Infrastructure.Persistence.Configurations;

internal sealed class GradeRowConfiguration : IEntityTypeConfiguration<GradeRow>
{
    public void Configure(EntityTypeBuilder<GradeRow> b)
    {
        b.ToTable("grade_rows");
        b.HasKey(x => x.Id);
        b.Property(x => x.Nid).HasMaxLength(14).IsRequired();
        b.Property(x => x.SeatingNumber).HasMaxLength(32);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.Branch).HasMaxLength(200);
        b.Property(x => x.School).HasMaxLength(200);
        b.Property(x => x.Region).HasMaxLength(120);
        b.Property(x => x.Status).HasMaxLength(64);
        b.Property(x => x.Total).HasPrecision(7, 2);
        b.Property(x => x.ImportMax).HasPrecision(7, 2);
        b.Property(x => x.OverrideMax).HasPrecision(7, 2);
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => x.Nid).IsUnique();
        b.HasIndex(x => x.Seat);

        b.HasMany(x => x.Adjustments)
            .WithOne()
            .HasForeignKey(a => a.GradeRowId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
