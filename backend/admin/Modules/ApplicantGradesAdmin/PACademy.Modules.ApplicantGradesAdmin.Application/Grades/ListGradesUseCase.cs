using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed class ListGradesUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<GradeListResult> ExecuteAsync(GradeListFilters filters, CancellationToken ct = default)
    {
        var q = db.ApplicantGrades
            .AsNoTracking()
            .Include(x => x.Adjustments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filters.Gender))
            q = q.Where(x => x.Gender == filters.Gender);
        if (!string.IsNullOrWhiteSpace(filters.Branch))
            q = q.Where(x => x.Branch == filters.Branch);
        if (filters.GraduationYear.HasValue)
            q = q.Where(x => x.GraduationYear == filters.GraduationYear);
        if (!string.IsNullOrWhiteSpace(filters.SchoolCategoryCode))
            q = q.Where(x => x.SchoolCategoryCode == filters.SchoolCategoryCode);
        if (filters.ChangedOnly == true)
            q = q.Where(x => x.Adjustments.Any(a => a.IsActive) || x.OverrideMax != null || x.GradeChangedAt != null);

        var rows = await GradeImportLogic.ApplySort(q, filters.Sort).ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var search = filters.Search.Trim();
            var searchDigits = new string(GradeImportLogic.ToAsciiDigits(search).Where(char.IsDigit).ToArray());
            var searchArabic = GradeImportLogic.NormalizeArabic(search);
            rows = rows.Where(x =>
                (!string.IsNullOrWhiteSpace(searchDigits) && (
                    x.Nid.StartsWith(searchDigits, StringComparison.Ordinal) ||
                    (x.SeatingNumber?.StartsWith(searchDigits, StringComparison.Ordinal) ?? false) ||
                    x.Seat.ToString().StartsWith(searchDigits, StringComparison.Ordinal))) ||
                (!string.IsNullOrWhiteSpace(searchArabic) && (
                    GradeImportLogic.NormalizeArabic(x.Name).Contains(searchArabic, StringComparison.Ordinal) ||
                    GradeImportLogic.NormalizeArabic(x.School).Contains(searchArabic, StringComparison.Ordinal))))
                .ToList();
        }

        var total = rows.Count;
        if (filters.Page.HasValue || filters.PageSize.HasValue)
        {
            var page = Math.Max(filters.Page ?? 1, 1);
            var pageSize = Math.Clamp(filters.PageSize ?? 25, 1, 10_000);
            rows = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        }

        return new GradeListResult(rows.Select(GradeMapper.ToDto).ToList(), total);
    }
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
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        await db.ApplicantGradeAdjustments.ExecuteDeleteAsync(ct);
        await db.ApplicantGrades.ExecuteDeleteAsync(ct);
    }
}
