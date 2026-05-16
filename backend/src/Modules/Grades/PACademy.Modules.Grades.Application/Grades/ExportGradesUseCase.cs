using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Application.Grades;

public sealed class ExportGradesUseCase(IGradesDbContext db)
{
    public async Task<IReadOnlyList<GradeRowDto>> ExecuteAsync(
        ExportRequest req, CancellationToken ct = default)
    {
        IQueryable<GradeRow> q = db.GradeRows.Include(r => r.Adjustments);

        var search = req.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            var digits = new string(search.Where(char.IsDigit).ToArray());
            if (digits.Length > 0)
                q = q.Where(r => r.Nid.StartsWith(digits)
                              || (r.SeatingNumber != null && r.SeatingNumber.StartsWith(digits))
                              || EF.Functions.Like(r.Name, $"%{search}%"));
            else
                q = q.Where(r => EF.Functions.Like(r.Name, $"%{search}%"));
        }

        q = ListPaginatedGradesUseCase.ApplySort(q, req.SortKey, req.SortDirection);

        var rows = await q.ToListAsync(ct);
        return rows.Select(GradeMapper.ToDto).ToList();
    }
}
