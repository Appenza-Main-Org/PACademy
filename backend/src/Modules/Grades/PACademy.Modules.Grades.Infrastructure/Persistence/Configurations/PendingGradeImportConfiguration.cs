using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Infrastructure.Persistence.Configurations;

internal sealed class PendingGradeImportConfiguration : IEntityTypeConfiguration<PendingGradeImport>
{
    public void Configure(EntityTypeBuilder<PendingGradeImport> b)
    {
        b.ToTable("pending_grade_imports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.MaxDegree).HasPrecision(7, 2);
        b.Property(x => x.NewRowsJson).HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.DuplicatesJson).HasColumnType("nvarchar(max)").IsRequired();

        b.HasIndex(x => x.CreatedAt).HasDatabaseName("IX_pending_grade_imports_created_at");
    }
}
