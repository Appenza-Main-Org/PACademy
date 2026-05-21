using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Shared.Persistence.Grades;

public sealed class GradeImportRowConfiguration : IEntityTypeConfiguration<GradeImportRow>
{
    public void Configure(EntityTypeBuilder<GradeImportRow> b)
    {
        b.ToTable("grade_import_rows");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.GradeImportBatchId).HasColumnName("grade_import_batch_id").IsRequired();
        b.Property(x => x.SourceRowIndex).HasColumnName("source_row_index").IsRequired();
        b.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(14).IsRequired();
        b.Property(x => x.IsValid).HasColumnName("is_valid").IsRequired();
        b.Property(x => x.PayloadJson).HasColumnName("payload_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.ErrorsJson).HasColumnName("errors_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasIndex(x => x.GradeImportBatchId);
        b.HasIndex(x => x.NationalId);
    }
}
