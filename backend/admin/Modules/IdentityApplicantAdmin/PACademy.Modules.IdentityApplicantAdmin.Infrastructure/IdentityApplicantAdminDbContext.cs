using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Identity;
using PACademy.Shared.Persistence.Identity;

namespace PACademy.Modules.IdentityApplicantAdmin.Infrastructure;

/// <summary>
/// Admin-owned DbContext for the <c>applicants</c> table. Used only by
/// the admin backend for migrations + the dev seeder — applicant
/// backend has its own read+write context with a tighter surface.
/// </summary>
public sealed class IdentityApplicantAdminDbContext(DbContextOptions<IdentityApplicantAdminDbContext> options)
    : DbContext(options)
{
    public DbSet<Applicant> Applicants => Set<Applicant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        /* Apply ONLY this module's entity configurations. Using
         * ApplyConfigurationsFromAssembly(typeof(ApplicantConfiguration).Assembly)
         * would scan the entire shared Persistence assembly and pull in
         * every other module's tables (Faculty, ApplicantGrade, …)
         * which then land in this module's migration history. */
        modelBuilder.ApplyConfiguration(new ApplicantConfiguration());
    }
}
