using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Shared.Persistence.Grades;

public sealed class GradeImportBatchConfiguration : IEntityTypeConfiguration<GradeImportBatch>
{
    public void Configure(EntityTypeBuilder<GradeImportBatch> b)
    {
        b.ToTable("grade_import_batches");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.SourceFormat).HasColumnName("source_format").HasMaxLength(32).IsRequired();
        b.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
        b.Property(x => x.GraduationYear).HasColumnName("graduation_year");
        b.Property(x => x.SelectedSchoolCategoriesJson).HasColumnName("selected_school_categories_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.MaxGradeByCategoryJson).HasColumnName("max_grade_by_category_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.TotalRows).HasColumnName("total_rows").IsRequired();
        b.Property(x => x.ValidRows).HasColumnName("valid_rows").IsRequired();
        b.Property(x => x.InvalidRows).HasColumnName("invalid_rows").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasMany(x => x.Rows)
            .WithOne()
            .HasForeignKey(x => x.GradeImportBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Navigation(x => x.Rows)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
