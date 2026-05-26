using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Shared.Persistence.Grades;

public sealed class ApplicantGradeAdjustmentConfiguration : IEntityTypeConfiguration<ApplicantGradeAdjustment>
{
    public void Configure(EntityTypeBuilder<ApplicantGradeAdjustment> b)
    {
        b.ToTable("applicant_grade_adjustments");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.ApplicantGradeId).HasColumnName("applicant_grade_id").IsRequired();
        b.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(64).IsRequired();
        b.Property(x => x.ReasonLabel).HasColumnName("reason_label").HasMaxLength(120).IsRequired();
        b.Property(x => x.Note).HasColumnName("note").HasMaxLength(500).IsRequired();
        b.Property(x => x.Amount).HasColumnName("amount").HasPrecision(7, 2).IsRequired();
        b.Property(x => x.By).HasColumnName("by").HasMaxLength(120).IsRequired();
        b.Property(x => x.When).HasColumnName("when_label").HasMaxLength(64).IsRequired();
        b.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasIndex(x => x.ApplicantGradeId);
    }
}
