using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.Lookups;

namespace PACademy.Infrastructure.Persistence.Configurations.Lookups;

// All 21 lookup configurations live in a single file: each is small,
// they share many conventions, and grouping them keeps the column rules
// consistent across tables.

internal sealed class GovernorateConfiguration : IEntityTypeConfiguration<Governorate>
{
    public void Configure(EntityTypeBuilder<Governorate> b)
    {
        b.ToTable("governorates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
        b.Property(x => x.Region).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_governorates_key");
        b.HasIndex(x => x.SortOrder).HasDatabaseName("IX_governorates_sort");
    }
}

internal sealed class SpecializationConfiguration : IEntityTypeConfiguration<Specialization>
{
    public void Configure(EntityTypeBuilder<Specialization> b)
    {
        b.ToTable("specializations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.Code).HasMaxLength(32).IsRequired();
        b.Property(x => x.FacultyType).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_specializations_key");
        b.HasIndex(x => x.SortOrder).HasDatabaseName("IX_specializations_sort");
    }
}

internal sealed class RankConfiguration : IEntityTypeConfiguration<Rank>
{
    public void Configure(EntityTypeBuilder<Rank> b)
    {
        b.ToTable("ranks");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.Level).IsRequired();
        b.Property(x => x.ApplicableTo).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_ranks_key");
        b.HasIndex(x => x.SortOrder).HasDatabaseName("IX_ranks_sort");
    }
}

internal sealed class CollegeConfiguration : IEntityTypeConfiguration<College>
{
    public void Configure(EntityTypeBuilder<College> b)
    {
        b.ToTable("colleges");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.GovernorateId).IsRequired();
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_colleges_key");
        b.HasIndex(x => x.GovernorateId).HasDatabaseName("IX_colleges_governorate");
        b.HasOne<Governorate>().WithMany().HasForeignKey(x => x.GovernorateId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class QualificationConfiguration : IEntityTypeConfiguration<Qualification>
{
    public void Configure(EntityTypeBuilder<Qualification> b)
    {
        b.ToTable("qualifications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.Level).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.FacultyRequired).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_qualifications_key");
        b.HasIndex(x => x.SortOrder).HasDatabaseName("IX_qualifications_sort");
    }
}

internal sealed class NationalityConfiguration : IEntityTypeConfiguration<Nationality>
{
    public void Configure(EntityTypeBuilder<Nationality> b)
    {
        b.ToTable("nationalities");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
        b.Property(x => x.IsoCode).HasMaxLength(8).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_nationalities_key");
        b.HasIndex(x => x.IsoCode).HasDatabaseName("IX_nationalities_iso");
    }
}

internal sealed class RelationshipConfiguration : IEntityTypeConfiguration<Relationship>
{
    public void Configure(EntityTypeBuilder<Relationship> b)
    {
        b.ToTable("relationships");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.Degree).IsRequired();
        b.Property(x => x.Side).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_relationships_key");
        b.ToTable(t => t.HasCheckConstraint("CK_relationships_degree", "[Degree] BETWEEN 1 AND 4"));
    }
}

internal sealed class CaseTypeConfiguration : IEntityTypeConfiguration<CaseType>
{
    public void Configure(EntityTypeBuilder<CaseType> b)
    {
        b.ToTable("case_types");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.Severity).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.BlocksApplication).IsRequired();
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_case_types_key");
    }
}

// ─── Simple lookups (Gap-I) — shared shape via SimpleLookupBase ────────

internal static class SimpleLookupConfigurer
{
    public static void Configure<T>(EntityTypeBuilder<T> b, string tableName, string indexPrefix)
        where T : SimpleLookupBase
    {
        b.ToTable(tableName);
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(64).IsRequired();
        b.Property(x => x.LabelAr).HasMaxLength(200).IsRequired().UseCollation("Arabic_100_CI_AS_SC");
        b.Property(x => x.LabelEn).HasMaxLength(200);
        b.Property(x => x.SortOrder).HasDefaultValue(0).IsRequired();
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.IsSystem).HasDefaultValue(false).IsRequired();
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.Archived).HasDefaultValue(false).IsRequired();
        b.Property(x => x.DemoOrigin).HasDefaultValue(false).IsRequired();
        b.HasIndex(x => x.Key).IsUnique().HasDatabaseName($"IX_{indexPrefix}_key");
        b.HasIndex(x => x.SortOrder).HasDatabaseName($"IX_{indexPrefix}_sort");
    }
}

internal sealed class EducationTypeConfiguration : IEntityTypeConfiguration<EducationType>
{
    public void Configure(EntityTypeBuilder<EducationType> b)
        => SimpleLookupConfigurer.Configure(b, "education_types", "education_types");
}

internal sealed class MaritalStatusConfiguration : IEntityTypeConfiguration<MaritalStatus>
{
    public void Configure(EntityTypeBuilder<MaritalStatus> b)
        => SimpleLookupConfigurer.Configure(b, "marital_statuses", "marital_statuses");
}

internal sealed class UniversityConfiguration : IEntityTypeConfiguration<University>
{
    public void Configure(EntityTypeBuilder<University> b)
        => SimpleLookupConfigurer.Configure(b, "universities", "universities");
}

internal sealed class FacultyConfiguration : IEntityTypeConfiguration<Faculty>
{
    public void Configure(EntityTypeBuilder<Faculty> b)
    {
        SimpleLookupConfigurer.Configure(b, "faculties", "faculties");
        b.Property(x => x.UniversityId).IsRequired();
        b.HasIndex(x => x.UniversityId).HasDatabaseName("IX_faculties_university");
        b.HasOne<University>().WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SpecialtyTypeConfiguration : IEntityTypeConfiguration<SpecialtyType>
{
    public void Configure(EntityTypeBuilder<SpecialtyType> b)
        => SimpleLookupConfigurer.Configure(b, "specialty_types", "specialty_types");
}

internal sealed class SpecialtyConfiguration : IEntityTypeConfiguration<Specialty>
{
    public void Configure(EntityTypeBuilder<Specialty> b)
    {
        SimpleLookupConfigurer.Configure(b, "specialties", "specialties");
        b.Property(x => x.SpecialtyTypeId).IsRequired();
        b.Property(x => x.Gender).HasConversion<string>().HasMaxLength(10);
        b.HasIndex(x => x.SpecialtyTypeId).HasDatabaseName("IX_specialties_specialty_type");
        b.HasOne<SpecialtyType>().WithMany().HasForeignKey(x => x.SpecialtyTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class DegreeTypeConfiguration : IEntityTypeConfiguration<DegreeType>
{
    public void Configure(EntityTypeBuilder<DegreeType> b)
        => SimpleLookupConfigurer.Configure(b, "degree_types", "degree_types");
}

internal sealed class JobConfiguration : IEntityTypeConfiguration<Job>
{
    public void Configure(EntityTypeBuilder<Job> b)
        => SimpleLookupConfigurer.Configure(b, "jobs", "jobs");
}

internal sealed class ExamTypeConfiguration : IEntityTypeConfiguration<ExamType>
{
    public void Configure(EntityTypeBuilder<ExamType> b)
        => SimpleLookupConfigurer.Configure(b, "exam_types", "exam_types");
}

internal sealed class ExamGroupConfiguration : IEntityTypeConfiguration<ExamGroup>
{
    public void Configure(EntityTypeBuilder<ExamGroup> b)
        => SimpleLookupConfigurer.Configure(b, "exam_groups", "exam_groups");
}

internal sealed class CommitteeTypeConfiguration : IEntityTypeConfiguration<CommitteeType>
{
    public void Configure(EntityTypeBuilder<CommitteeType> b)
        => SimpleLookupConfigurer.Configure(b, "committee_types", "committee_types");
}

internal sealed class RejectionReasonConfiguration : IEntityTypeConfiguration<RejectionReason>
{
    public void Configure(EntityTypeBuilder<RejectionReason> b)
        => SimpleLookupConfigurer.Configure(b, "rejection_reasons", "rejection_reasons");
}

internal sealed class NotificationDepartmentConfiguration : IEntityTypeConfiguration<NotificationDepartment>
{
    public void Configure(EntityTypeBuilder<NotificationDepartment> b)
        => SimpleLookupConfigurer.Configure(b, "notification_departments", "notification_departments");
}
