using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Domain.AdmissionRules;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Domain.Categories;
using PACademy.Domain.Cycles;
using PACademy.Domain.Lookups;
using PACademy.Domain.Sessions;
using PACademy.Domain.Workflows;
using System.Data;

namespace PACademy.Application.Common;

/// <summary>
/// Application-layer abstraction over PaDbContext. Exposes DbSets so use cases
/// can issue EF Core queries without depending on Infrastructure concretes.
/// </summary>
public interface IPaDbContext
{
    DbSet<Applicant> Applicants { get; }
    DbSet<ApplicantStageSubmission> ApplicantStageSubmissions { get; }
    DbSet<Cycle> Cycles { get; }
    DbSet<Category> Categories { get; }
    DbSet<Workflow> Workflows { get; }
    DbSet<AdmissionRule> AdmissionRules { get; }
    DbSet<Session> Sessions { get; }
    DbSet<AuditEntry> AuditEntries { get; }

    // ─── 21 split lookup tables ───────────────────────────────────────────
    DbSet<Governorate> Governorates { get; }
    DbSet<Specialization> Specializations { get; }
    DbSet<Rank> Ranks { get; }
    DbSet<College> Colleges { get; }
    DbSet<Qualification> Qualifications { get; }
    DbSet<Nationality> Nationalities { get; }
    DbSet<Relationship> Relationships { get; }
    DbSet<CaseType> CaseTypes { get; }
    DbSet<EducationType> EducationTypes { get; }
    DbSet<MaritalStatus> MaritalStatuses { get; }
    DbSet<University> Universities { get; }
    DbSet<Faculty> Faculties { get; }
    DbSet<Specialty> Specialties { get; }
    DbSet<SpecialtyType> SpecialtyTypes { get; }
    DbSet<DegreeType> DegreeTypes { get; }
    DbSet<Job> Jobs { get; }
    DbSet<ExamType> ExamTypes { get; }
    DbSet<ExamGroup> ExamGroups { get; }
    DbSet<CommitteeType> CommitteeTypes { get; }
    DbSet<RejectionReason> RejectionReasons { get; }
    DbSet<NotificationDepartment> NotificationDepartments { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default);
}
