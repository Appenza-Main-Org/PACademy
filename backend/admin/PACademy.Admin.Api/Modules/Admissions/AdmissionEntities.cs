using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Lookups;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class AdmissionCycleEntity
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
}

public sealed class ApplicantCategoryEntity
{
    public required string Key { get; set; }
    public required string LabelAr { get; set; }
    public bool IsOpen { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class AdmissionRuleEntity
{
    public required string Id { get; set; }
    public required string CycleId { get; set; }
    public int Version { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ApplicationSettingsCategoryConfigEntity
{
    public required string Id { get; set; }
    public required string CategoryId { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ApplicationSettingsCategorySpecializationEntity
{
    public required string Id { get; set; }
    public required string ConfigId { get; set; }
    public required string SpecializationId { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ApplicationSettingsGraduationYearEntity
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
}

public interface IAdmissionsDbContext
{
    DbSet<AdmissionCycleEntity> AdmissionCycles { get; }
    DbSet<ApplicantCategoryEntity> ApplicantCategories { get; }
    DbSet<AdmissionRuleEntity> AdmissionRules { get; }
    DbSet<ApplicationSettingsCategoryConfigEntity> ApplicationSettingsCategoryConfigs { get; }
    DbSet<ApplicationSettingsCategorySpecializationEntity> ApplicationSettingsCategorySpecializations { get; }
    DbSet<ApplicationSettingsGraduationYearEntity> ApplicationSettingsGraduationYears { get; }
    DbSet<LookupRowEntity> LookupRows { get; }
    DbSet<AuditRowEntity> AuditRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
