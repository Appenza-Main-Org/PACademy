using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Application.Mapping;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Application.Grades;

public sealed class ListPaginatedGradesUseCase(IGradesDbContext db)
{
    public async Task<PaginatedGradesResult> ExecuteAsync(
        ListPaginatedRequest req, CancellationToken ct = default)
    {
        var page = Math.Max(1, req.Page);
        var size = Math.Clamp(req.PageSize, 1, 500);

        IQueryable<GradeRow> q = db.GradeRows.Include(r => r.Adjustments);

        var search = req.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            /* Backend search: digit-prefix on Nid / SeatingNumber OR
             * case-insensitive contains on Name. Front-end normalises
             * Arabic shaping/diacritics before sending. */
            var digits = new string(search.Where(char.IsDigit).ToArray());
            if (digits.Length > 0)
                q = q.Where(r => r.Nid.StartsWith(digits)
                              || (r.SeatingNumber != null && r.SeatingNumber.StartsWith(digits))
                              || EF.Functions.Like(r.Name, $"%{search}%"));
            else
                q = q.Where(r => EF.Functions.Like(r.Name, $"%{search}%"));
        }

        q = ApplySort(q, req.SortKey, req.SortDirection);

        var total = await q.CountAsync(ct);
        var rows = await q
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        return new PaginatedGradesResult(rows.Select(GradeMapper.ToDto).ToList(), total);
    }

    internal static IQueryable<GradeRow> ApplySort(
        IQueryable<GradeRow> q, string? key, string? direction)
    {
        var asc = !string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase);
        return key?.ToLowerInvariant() switch
        {
            "seat" => asc ? q.OrderBy(r => r.Seat) : q.OrderByDescending(r => r.Seat),
            "nid" => asc ? q.OrderBy(r => r.Nid) : q.OrderByDescending(r => r.Nid),
            "name" => asc ? q.OrderBy(r => r.Name) : q.OrderByDescending(r => r.Name),
            "total" => asc ? q.OrderBy(r => r.Total) : q.OrderByDescending(r => r.Total),
            "branch" => asc ? q.OrderBy(r => r.Branch) : q.OrderByDescending(r => r.Branch),
            "school" => asc ? q.OrderBy(r => r.School) : q.OrderByDescending(r => r.School),
            "region" => asc ? q.OrderBy(r => r.Region) : q.OrderByDescending(r => r.Region),
            _ => q.OrderBy(r => r.Seat),
        };
    }
}
