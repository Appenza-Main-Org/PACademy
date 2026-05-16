using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Application;

public interface IGradesDbContext
{
    DbSet<GradeRow> GradeRows { get; }
    DbSet<GradeAdjustment> GradeAdjustments { get; }
    DbSet<PendingGradeImport> PendingGradeImports { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
