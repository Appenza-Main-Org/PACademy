using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Infrastructure.Persistence.Configurations;

internal sealed class GradeAdjustmentConfiguration : IEntityTypeConfiguration<GradeAdjustment>
{
    public void Configure(EntityTypeBuilder<GradeAdjustment> b)
    {
        b.ToTable("grade_adjustments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Reason).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.Amount).HasPrecision(7, 2);
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => x.GradeRowId);
    }
}
