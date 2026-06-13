using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionCycleEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string NameAr { get; set; }
    public int Year { get; set; }
    public required string Status { get; set; }
    public bool IsActive { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public sealed class ApplicantCategoryEntity : IChangeTracked
{
    public required string Key { get; set; }
    public required string LabelAr { get; set; }
    public bool IsOpen { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public sealed class AdmissionRuleEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string CycleId { get; set; }
    public int Version { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public sealed class ApplicationSettingsCategoryConfigEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string CategoryId { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public sealed class ApplicationSettingsCategorySpecializationEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string ConfigId { get; set; }
    public required string SpecializationId { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public sealed class ApplicationSettingsGraduationYearEntity : IChangeTracked
{
    public required string Id { get; set; }
    public required string CategorySpecializationId { get; set; }
    public required string GraduationYearsJson { get; set; }
    public required string GenderTypesJson { get; set; }
    public required string MaritalStatusCodesJson { get; set; }
    public int? AgeMin { get; set; }
    public int? MaxAge { get; set; }
    public required string DivisionCodesJson { get; set; }
    public required string SchoolCategoryCodesJson { get; set; }
    public DateOnly ApplicationStartDate { get; set; }
    public DateOnly ApplicationEndDate { get; set; }
    public DateOnly AgeReferenceDate { get; set; }
    public bool IsActive { get; set; }
    public required string GradeKind { get; set; }
    public decimal? MinPercentage { get; set; }
    public string? AcademicGradeId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

/// <summary>
/// One renderable educational score field for an applicant category. Drives
/// the portal profile's educational sections (config-driven rendering +
/// validation — no hardcoded score fields on the page). `InputKind` and
/// `SectionKey` are registry-validated strings, not enums, so new values
/// remain a data change.
/// </summary>
public sealed class CategoryEducationFieldEntity : IChangeTracked
{
    public required string Id { get; set; }
    /// <summary>FK → applicant-categories lookup code (e.g. officers_general).</summary>
    public required string CategoryKey { get; set; }
    /// <summary>Storage key on the portal profile payload (e.g. thanawiTotal).</summary>
    public required string FieldKey { get; set; }
    public required string LabelAr { get; set; }
    /// <summary>number | percentage | academic-grade | text.</summary>
    public required string InputKind { get; set; }
    /// <summary>secondary | university | postgraduate | doctorate.</summary>
    public required string SectionKey { get; set; }
    public bool IsRequired { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}

public interface IAdmissionsDbContext
{
    DbSet<AdmissionCycleEntity> AdmissionCycles { get; }
    DbSet<ApplicantCategoryEntity> ApplicantCategories { get; }
    DbSet<AdmissionRuleEntity> AdmissionRules { get; }
    DbSet<ApplicationSettingsCategoryConfigEntity> ApplicationSettingsCategoryConfigs { get; }
    DbSet<ApplicationSettingsCategorySpecializationEntity> ApplicationSettingsCategorySpecializations { get; }
    DbSet<ApplicationSettingsGraduationYearEntity> ApplicationSettingsGraduationYears { get; }
    DbSet<CategoryEducationFieldEntity> CategoryEducationFields { get; }
    DbSet<LookupRowEntity> LookupRows { get; }
    DbSet<AuditRowEntity> AuditRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
