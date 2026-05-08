using Microsoft.EntityFrameworkCore;
using PACademy.Domain.AdmissionRules;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Domain.Categories;
using PACademy.Domain.Cycles;
using PACademy.Domain.ReferenceData;
using PACademy.Domain.Sessions;
using PACademy.Domain.Workflows;

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
    DbSet<ReferenceDataEntry> ReferenceDataEntries { get; }
    DbSet<Session> Sessions { get; }
    DbSet<AuditEntry> AuditEntries { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
