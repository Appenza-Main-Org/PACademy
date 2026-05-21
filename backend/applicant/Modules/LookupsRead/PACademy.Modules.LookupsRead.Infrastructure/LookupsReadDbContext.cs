using Microsoft.EntityFrameworkCore;
using PACademy.Modules.LookupsRead.Application;
using PACademy.Shared.Domain.Lookups;
using PACademy.Shared.Persistence.Lookups;

namespace PACademy.Modules.LookupsRead.Infrastructure;

/// <summary>
/// EF Core DbContext backing the applicant backend's lookup queries.
///
/// Read-only enforcement is at the <em>interface</em> surface:
/// <see cref="ILookupsReadDbContext"/> only exposes <see cref="IQueryable{T}"/>,
/// so consumer use cases have no compile-time path to call Add/Update/Remove.
///
/// SaveChanges is left intact (not overridden to throw) so the dev seeder
/// + any future admin-callable internal helpers can write. Application
/// boundaries are enforced via architecture tests + the
/// <see cref="ILookupsReadDbContext"/> contract — not by sabotaging the
/// underlying EF behaviour.
/// </summary>
public sealed class LookupsReadDbContext(DbContextOptions<LookupsReadDbContext> options)
    : DbContext(options), ILookupsReadDbContext
{
    public DbSet<Faculty> FacultiesSet => Set<Faculty>();

    /* IQueryable surface used by the Application layer's use cases.
     * AsNoTracking is forced here so callers never accidentally bring
     * a tracking proxy across the read boundary. */
    public IQueryable<Faculty> Faculties => FacultiesSet.AsNoTracking();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfiguration(new FacultyConfiguration());
}
