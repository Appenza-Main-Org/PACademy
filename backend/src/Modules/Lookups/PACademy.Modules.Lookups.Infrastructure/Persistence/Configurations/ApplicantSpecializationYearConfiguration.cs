using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

public sealed class ApplicantSpecializationYearConfiguration : IEntityTypeConfiguration<ApplicantSpecializationYear>
{
    public void Configure(EntityTypeBuilder<ApplicantSpecializationYear> b)
    {
        b.ToTable("applicant_specialization_years");

        b.HasKey(y => y.Id);

        b.Property(y => y.Id).HasColumnName("id");
        b.Property(y => y.CategorySpecializationId).HasColumnName("category_specialization_id").IsRequired();

        b.Property(y => y.GraduationYearsJson).HasColumnName("graduation_years").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(y => y.GenderTypesJson).HasColumnName("gender_types").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(y => y.MaritalStatusCodesJson).HasColumnName("marital_status_codes").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(y => y.DivisionCodesJson).HasColumnName("division_codes").HasColumnType("nvarchar(max)").IsRequired();
        b.Property(y => y.SchoolCategoryCodesJson).HasColumnName("school_category_codes").HasColumnType("nvarchar(max)").IsRequired();

        b.Property(y => y.AgeMin).HasColumnName("age_min");
        b.Property(y => y.MaxAge).HasColumnName("max_age");

        b.Property(y => y.ApplicationStartDate).HasColumnName("application_start_date").IsRequired();
        b.Property(y => y.ApplicationEndDate).HasColumnName("application_end_date").IsRequired();
        b.Property(y => y.AgeReferenceDate).HasColumnName("age_reference_date").IsRequired();

        b.Property(y => y.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);

        b.Property(y => y.GradeKind).HasColumnName("grade_kind").HasMaxLength(16).IsRequired();
        b.Property(y => y.MinPercentage).HasColumnName("min_percentage");
        b.Property(y => y.AcademicGradeId).HasColumnName("academic_grade_id").HasMaxLength(64);

        b.Property(y => y.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(y => y.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.Property(y => y.RowVersion)
            .HasColumnName("row_version")
            .IsRowVersion();

        b.HasOne<ApplicantCategorySpecialization>()
            .WithMany()
            .HasForeignKey(y => y.CategorySpecializationId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(y => y.CategorySpecializationId)
            .HasDatabaseName("IX_AppSpecYear_CategorySpec");

        b.HasIndex(y => new { y.CategorySpecializationId, y.IsActive })
            .HasDatabaseName("IX_AppSpecYear_Active");
    }
}
