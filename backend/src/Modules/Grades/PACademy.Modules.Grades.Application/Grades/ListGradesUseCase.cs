using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;

namespace PACademy.Modules.Grades.Application.Grades;

public sealed class ListGradesUseCase(IGradesDbContext db)
{
    public async Task<IReadOnlyList<GradeRowDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var rows = await db.GradeRows
            .Include(r => r.Adjustments)
            .OrderBy(r => r.Seat)
            .ToListAsync(ct);
        return rows.Select(GradeMapper.ToDto).ToList();
    }
}
