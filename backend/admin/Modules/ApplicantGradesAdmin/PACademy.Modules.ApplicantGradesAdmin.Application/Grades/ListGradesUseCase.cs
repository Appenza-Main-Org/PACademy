using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed class ListGradesUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<GradeListResult> ExecuteAsync(GradeListFilters filters, CancellationToken ct = default)
    {
        var q = db.ApplicantGrades
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filters.Gender))
            q = q.Where(x => x.Gender == filters.Gender);
        if (!string.IsNullOrWhiteSpace(filters.Branch))
            q = q.Where(x => x.Branch == filters.Branch);
        if (filters.GraduationYear.HasValue)
            q = q.Where(x => x.GraduationYear == filters.GraduationYear);
        if (!string.IsNullOrWhiteSpace(filters.SchoolCategoryCode))
            q = q.Where(x => x.SchoolCategoryCode == filters.SchoolCategoryCode);
        if (filters.SchoolCategoryCodes is { Count: > 0 })
            q = q.Where(x => x.SchoolCategoryCode != null && filters.SchoolCategoryCodes.Contains(x.SchoolCategoryCode));
        if (filters.ChangedOnly == true)
            q = q.Where(x => x.Adjustments.Any(a => a.IsActive) || x.OverrideMax != null || x.GradeChangedAt != null);

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var search = filters.Search.Trim();
            var searchDigits = new string(GradeImportLogic.ToAsciiDigits(search).Where(char.IsDigit).ToArray());
            var text = search.Replace("[", "[[]", StringComparison.Ordinal)
                .Replace("%", "[%]", StringComparison.Ordinal)
                .Replace("_", "[_]", StringComparison.Ordinal);
            if (!string.IsNullOrWhiteSpace(searchDigits))
            {
                var hasSeat = int.TryParse(searchDigits, out var seat);
                q = q.Where(x =>
                    EF.Functions.Like(x.Nid, searchDigits + "%") ||
                    (x.SeatingNumber != null && EF.Functions.Like(x.SeatingNumber, searchDigits + "%")) ||
                    (hasSeat && x.Seat == seat) ||
                    EF.Functions.Like(x.Name, "%" + text + "%") ||
                    EF.Functions.Like(x.School, "%" + text + "%"));
            }
            else
            {
                q = q.Where(x =>
                    EF.Functions.Like(x.Name, "%" + text + "%") ||
                    EF.Functions.Like(x.School, "%" + text + "%"));
            }
        }

        if (!string.IsNullOrWhiteSpace(filters.Nid))
        {
            var text = EscapeLike(filters.Nid);
            q = q.Where(x => EF.Functions.Like(x.Nid, "%" + text + "%"));
        }
        if (!string.IsNullOrWhiteSpace(filters.SeatingNumber))
        {
            var text = EscapeLike(filters.SeatingNumber);
            q = q.Where(x => x.SeatingNumber != null && EF.Functions.Like(x.SeatingNumber, "%" + text + "%"));
        }
        if (!string.IsNullOrWhiteSpace(filters.Name))
        {
            var text = EscapeLike(filters.Name);
            q = q.Where(x => EF.Functions.Like(x.Name, "%" + text + "%"));
        }
        if (!string.IsNullOrWhiteSpace(filters.SchoolName))
        {
            var text = EscapeLike(filters.SchoolName);
            q = q.Where(x => EF.Functions.Like(x.School, "%" + text + "%"));
        }

        if (filters.TotalMin.HasValue)
            q = q.Where(x => x.Total >= filters.TotalMin);
        if (filters.TotalMax.HasValue)
            q = q.Where(x => x.Total <= filters.TotalMax);
        if (filters.PctMin.HasValue)
            q = q.Where(x => x.Total * 100 / (x.OverrideMax ?? x.ImportMax) >= filters.PctMin);
        if (filters.PctMax.HasValue)
            q = q.Where(x => x.Total * 100 / (x.OverrideMax ?? x.ImportMax) <= filters.PctMax);
        if (filters.EffMin.HasValue)
            q = q.Where(x => x.Total + x.Adjustments.Where(a => a.IsActive).Sum(a => a.Amount) >= filters.EffMin);
        if (filters.EffMax.HasValue)
            q = q.Where(x => x.Total + x.Adjustments.Where(a => a.IsActive).Sum(a => a.Amount) <= filters.EffMax);
        if (filters.GraduationYearMin.HasValue)
            q = q.Where(x => x.GraduationYear >= filters.GraduationYearMin);
        if (filters.GraduationYearMax.HasValue)
            q = q.Where(x => x.GraduationYear <= filters.GraduationYearMax);

        var total = await q.CountAsync(ct);
        q = GradeImportLogic.ApplySort(q, filters.Sort);

        if (filters.Page.HasValue || filters.PageSize.HasValue)
        {
            var page = Math.Max(filters.Page ?? 1, 1);
            var pageSize = Math.Clamp(filters.PageSize ?? 25, 1, 10_000);
            q = q.Skip((page - 1) * pageSize).Take(pageSize);
        }

        var rows = await q
            .Include(x => x.Adjustments)
            .ToListAsync(ct);

        return new GradeListResult(rows.Select(GradeMapper.ToDto).ToList(), total);
    }

    private static string EscapeLike(string value)
        => value.Trim()
            .Replace("[", "[[]", StringComparison.Ordinal)
            .Replace("%", "[%]", StringComparison.Ordinal)
            .Replace("_", "[_]", StringComparison.Ordinal);
}

public sealed class FindGradeByNidUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<GradeRowDto?> ExecuteAsync(string nid, CancellationToken ct = default)
    {
        var normalized = GradeImportLogic.ToAsciiDigits(nid);
        var row = await db.ApplicantGrades
            .AsNoTracking()
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Nid == normalized, ct);
        return row is null ? null : GradeMapper.ToDto(row);
    }
}

public sealed class ClearGradesUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<int> ExecuteAsync(CancellationToken ct = default)
    {
        await db.ApplicantGradeAdjustments.ExecuteDeleteAsync(ct);
        return await db.ApplicantGrades.ExecuteDeleteAsync(ct);
    }

    public async Task<int> DeleteRowsAsync(IReadOnlyCollection<int> seats, CancellationToken ct = default)
    {
        if (seats.Count == 0) return 0;
        await db.ApplicantGradeAdjustments
            .Where(x => db.ApplicantGrades
                .Where(g => seats.Contains(g.Seat))
                .Select(g => g.Id)
                .Contains(x.ApplicantGradeId))
            .ExecuteDeleteAsync(ct);
        return await db.ApplicantGrades
            .Where(x => seats.Contains(x.Seat))
            .ExecuteDeleteAsync(ct);
    }
}
