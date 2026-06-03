using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Shared.Persistence.Grades;

public sealed class ApplicantGradeConfiguration : IEntityTypeConfiguration<ApplicantGrade>
{
    public void Configure(EntityTypeBuilder<ApplicantGrade> b)
    {
        b.ToTable("applicant_grades");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.AdminRecordId).HasColumnName("admin_record_id").HasMaxLength(128);
        b.Property(x => x.Seat).HasColumnName("seat").IsRequired();
        b.Property(x => x.SeatingNumber).HasColumnName("seating_number").HasMaxLength(32);
        b.Property(x => x.Nid).HasColumnName("nid").HasMaxLength(14).IsRequired();
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(16).IsRequired();
        b.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(16).IsRequired();
        b.Property(x => x.Branch).HasColumnName("branch").HasMaxLength(200).IsRequired();
        b.Property(x => x.GraduationYear).HasColumnName("graduation_year");
        b.Property(x => x.SchoolCategoryCode).HasColumnName("school_category_code").HasMaxLength(32);
        b.Property(x => x.School).HasColumnName("school").HasMaxLength(200).IsRequired();
        b.Property(x => x.Region).HasColumnName("region").HasMaxLength(120).IsRequired();
        b.Property(x => x.ExamRound).HasColumnName("exam_round").HasMaxLength(64);
        b.Property(x => x.Total).HasColumnName("total").HasPrecision(7, 2).IsRequired();
        b.Property(x => x.ImportMax).HasColumnName("import_max").HasPrecision(7, 2).IsRequired();
        b.Property(x => x.OverrideMax).HasColumnName("override_max").HasPrecision(7, 2);
        b.Property(x => x.LastEditedAt).HasColumnName("last_edited_at").HasMaxLength(64);
        b.Property(x => x.LastEditedBy).HasColumnName("last_edited_by").HasMaxLength(120);
        b.Property(x => x.GradeChangedAt).HasColumnName("grade_changed_at");
        b.Property(x => x.PreviousGrade).HasColumnName("previous_grade").HasPrecision(7, 2);
        b.Property(x => x.Status).HasColumnName("status").HasMaxLength(64).IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.PayloadJson).HasColumnName("payload_json").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        b.HasIndex(x => x.AdminRecordId).IsUnique().HasFilter("[admin_record_id] IS NOT NULL");
        b.HasIndex(x => x.Nid).IsUnique();
        b.HasIndex(x => x.Seat).IsUnique();
        b.HasIndex(x => x.SchoolCategoryCode);
        b.HasIndex(x => x.GraduationYear);
        b.HasIndex(x => new { x.SchoolCategoryCode, x.Seat });
        b.HasIndex(x => new { x.GraduationYear, x.Seat });
        b.HasIndex(x => new { x.Gender, x.Seat });
        b.HasIndex(x => new { x.Branch, x.Seat });

        b.HasMany(x => x.Adjustments)
            .WithOne()
            .HasForeignKey(x => x.ApplicantGradeId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Navigation(x => x.Adjustments)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
