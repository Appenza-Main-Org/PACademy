using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Identity;

namespace PACademy.Modules.IdentityApplicant.Application.Auth;

/// <summary>
/// Read+write access to the <c>applicants</c> table from the applicant
/// backend. Unlike the lookup tables (read-only on this side), the
/// applicants table IS written by this backend on first login of an
/// unknown NID (auto-create from MOI or manual-entry stub).
/// </summary>
public interface IApplicantsDbContext
{
    DbSet<Applicant> Applicants { get; }
    Task<int> SaveChangesAsync(CancellationToken ct);
}
