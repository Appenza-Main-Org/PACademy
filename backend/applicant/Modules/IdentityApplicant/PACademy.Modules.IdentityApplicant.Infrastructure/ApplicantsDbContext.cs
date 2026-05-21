using Microsoft.EntityFrameworkCore;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Shared.Domain.Identity;
using PACademy.Shared.Persistence.Identity;

namespace PACademy.Modules.IdentityApplicant.Infrastructure;

/// <summary>
/// Applicant-side DbContext for the <c>applicants</c> table. Owns
/// writes (auto-create on first login) — unlike the lookups read context
/// which only exposes IQueryable.
///
/// Migrations are owned by the admin backend's
/// <c>IdentityApplicantAdminDbContext</c>; this context never gets a
/// MigrationsAssembly so a stray <c>dotnet ef database update</c> from
/// here will no-op.
/// </summary>
public sealed class ApplicantsDbContext(DbContextOptions<ApplicantsDbContext> options)
    : DbContext(options), IApplicantsDbContext
{
    public DbSet<Applicant> Applicants => Set<Applicant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        /* Apply ONLY this module's entity configurations — see the
         * same comment on IdentityApplicantAdminDbContext for why
         * scanning the shared assembly is the wrong default. */
        modelBuilder.ApplyConfiguration(new ApplicantConfiguration());
    }

    Task<int> IApplicantsDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
