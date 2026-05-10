namespace PACademy.Contracts.Admin.Lookups;

/// <summary>Shared DTO shape for the 11 simple lookup catalogues (no extra columns).</summary>
public abstract record SimpleLookupDto(
    Guid Id, string Key, string LabelAr, string? LabelEn,
    int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);

public abstract record CreateSimpleLookupRequest(
    string Key, string LabelAr, string? LabelEn, int? SortOrder);

public abstract record UpdateSimpleLookupRequest(
    string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive);

// ── Per-entity sealed records (so each endpoint has its own type identity) ──

public sealed record EducationTypeDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateEducationTypeRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateEducationTypeRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record MaritalStatusDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateMaritalStatusRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateMaritalStatusRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record UniversityDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateUniversityRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateUniversityRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record SpecialtyTypeDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateSpecialtyTypeRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateSpecialtyTypeRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record DegreeTypeDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateDegreeTypeRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateDegreeTypeRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record JobDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateJobRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateJobRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record ExamTypeDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateExamTypeRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateExamTypeRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record ExamGroupDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateExamGroupRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateExamGroupRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record CommitteeTypeDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateCommitteeTypeRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateCommitteeTypeRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record RejectionReasonDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateRejectionReasonRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateRejectionReasonRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

public sealed record NotificationDepartmentDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt)
    : SimpleLookupDto(Id, Key, LabelAr, LabelEn, SortOrder, IsActive, IsSystem, Archived, ArchivedAt, CreatedAt);
public sealed record CreateNotificationDepartmentRequest(string Key, string LabelAr, string? LabelEn, int? SortOrder)
    : CreateSimpleLookupRequest(Key, LabelAr, LabelEn, SortOrder);
public sealed record UpdateNotificationDepartmentRequest(string? LabelAr, string? LabelEn, int? SortOrder, bool? IsActive)
    : UpdateSimpleLookupRequest(LabelAr, LabelEn, SortOrder, IsActive);

// ── Hierarchical lookups: Faculty (parent = University), Specialty (parent = SpecialtyType + gender) ──

public sealed record FacultyDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, Guid UniversityId,
    int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);
public sealed record CreateFacultyRequest(
    string Key, string LabelAr, string? LabelEn, Guid UniversityId, int? SortOrder);
public sealed record UpdateFacultyRequest(
    string? LabelAr, string? LabelEn, Guid? UniversityId, int? SortOrder, bool? IsActive);
public sealed record FacultyListFilters(
    Guid? UniversityId = null,
    string? Q = null, bool? IsActive = null, bool IncludeArchived = false,
    int Page = 1, int PageSize = 200, string? SortBy = null, string? SortDir = null)
    : LookupListFilters(Q, IsActive, IncludeArchived, Page, PageSize, SortBy, SortDir);

public sealed record SpecialtyDto(
    Guid Id, string Key, string LabelAr, string? LabelEn, Guid SpecialtyTypeId, string? Gender,
    int SortOrder, bool IsActive, bool IsSystem,
    bool Archived, DateTime? ArchivedAt, DateTime CreatedAt);
public sealed record CreateSpecialtyRequest(
    string Key, string LabelAr, string? LabelEn, Guid SpecialtyTypeId, string? Gender, int? SortOrder);
public sealed record UpdateSpecialtyRequest(
    string? LabelAr, string? LabelEn, Guid? SpecialtyTypeId, string? Gender, bool? ClearGender,
    int? SortOrder, bool? IsActive);
public sealed record SpecialtyListFilters(
    Guid? SpecialtyTypeId = null, string? Gender = null,
    string? Q = null, bool? IsActive = null, bool IncludeArchived = false,
    int Page = 1, int PageSize = 200, string? SortBy = null, string? SortDir = null)
    : LookupListFilters(Q, IsActive, IncludeArchived, Page, PageSize, SortBy, SortDir);
