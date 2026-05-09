using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Application;
using PACademy.Modules.ReferenceData.Domain;

namespace PACademy.Modules.ReferenceData.Infrastructure.Persistence;

public sealed class ReferenceDataDbContext : DbContext, IReferenceDataDbContext
{
    public ReferenceDataDbContext(DbContextOptions<ReferenceDataDbContext> options) : base(options) { }

    public DbSet<ReferenceDataEntry> ReferenceDataEntries => Set<ReferenceDataEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ReferenceDataDbContext).Assembly);
    }
}
