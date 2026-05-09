using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Admissions.Domain;
using PACademy.Shared.Audit.Domain;
using System.Data;

namespace PACademy.Modules.Admissions.Application;

/// <summary>
/// Application-layer abstraction over AdmissionsDbContext. Exposes DbSets so use
/// cases can issue EF Core queries without depending on Infrastructure concretes.
/// </summary>
public interface IAdmissionsDbContext
{
    DbSet<Applicant> Applicants { get; }
    DbSet<Cycle> Cycles { get; }
    DbSet<Category> Categories { get; }
    DbSet<AdmissionRule> AdmissionRules { get; }
    DbSet<AuditEntry> AuditEntries { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default);
}
