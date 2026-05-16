using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Infrastructure.Persistence;

public sealed class GradesDbContext(DbContextOptions<GradesDbContext> options)
    : DbContext(options), IGradesDbContext
{
    public DbSet<GradeRow> GradeRows => Set<GradeRow>();
    public DbSet<GradeAdjustment> GradeAdjustments => Set<GradeAdjustment>();
    public DbSet<PendingGradeImport> PendingGradeImports => Set<PendingGradeImport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfigurationsFromAssembly(typeof(GradesDbContext).Assembly);

    Task<int> IGradesDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
