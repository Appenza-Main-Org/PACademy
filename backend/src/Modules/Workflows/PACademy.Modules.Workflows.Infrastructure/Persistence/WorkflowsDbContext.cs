using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Workflows.Domain;

namespace PACademy.Modules.Workflows.Infrastructure.Persistence;

public sealed class WorkflowsDbContext : DbContext
{
    public WorkflowsDbContext(DbContextOptions<WorkflowsDbContext> options) : base(options) { }

    public DbSet<Workflow> Workflows => Set<Workflow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WorkflowsDbContext).Assembly);
    }
}
