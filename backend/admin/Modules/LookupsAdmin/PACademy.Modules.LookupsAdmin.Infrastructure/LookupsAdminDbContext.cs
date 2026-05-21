using Microsoft.EntityFrameworkCore;
using PACademy.Modules.LookupsAdmin.Application.Faculties;
using PACademy.Shared.Domain.Lookups;
using PACademy.Shared.Persistence.Lookups;

namespace PACademy.Modules.LookupsAdmin.Infrastructure;

/// <summary>
/// EF Core DbContext backing the admin LookupsAdmin module.
/// Exposes <see cref="DbSet{T}"/> for full CRUD; this is the only
/// DbContext that runs migrations against the shared SQL Server DB.
/// </summary>
public sealed class LookupsAdminDbContext(DbContextOptions<LookupsAdminDbContext> options)
    : DbContext(options), ILookupsAdminDbContext
{
    public DbSet<Faculty> Faculties => Set<Faculty>();
    public DbSet<LookupItem> LookupItems => Set<LookupItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new FacultyConfiguration());
        modelBuilder.ApplyConfiguration(new LookupItemConfiguration());
    }

    Task<int> ILookupsAdminDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
