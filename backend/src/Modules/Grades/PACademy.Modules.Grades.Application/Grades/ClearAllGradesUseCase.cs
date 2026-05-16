using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Grades.Application.Grades;

public sealed class ClearAllGradesUseCase(IGradesDbContext db)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        await db.GradeRows.ExecuteDeleteAsync(ct);
        await db.GradeAdjustments.ExecuteDeleteAsync(ct);
        await db.PendingGradeImports.ExecuteDeleteAsync(ct);
    }
}
