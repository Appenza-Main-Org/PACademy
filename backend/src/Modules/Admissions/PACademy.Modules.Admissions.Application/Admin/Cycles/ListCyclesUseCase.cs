using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class ListCyclesUseCase(IAdmissionsDbContext db)
{
    public async Task<PagedResult<CycleListItemDto>> ExecuteAsync(
        CycleListFilters filters,
        CancellationToken ct = default)
    {
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 200);

        var query = db.Cycles.AsNoTracking();

        if (!filters.IncludeArchived)
            query = query.Where(c => !c.Archived);

        if (!string.IsNullOrWhiteSpace(filters.Status)
            && Enum.TryParse<CycleStatus>(filters.Status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        if (filters.Year.HasValue)
            query = query.Where(c => c.Year == filters.Year.Value);

        if (!string.IsNullOrWhiteSpace(filters.Cohort))
            query = query.Where(c => c.Cohort == filters.Cohort);

        var total = await query.CountAsync(ct);

        var cycles = await query
            .OrderByDescending(c => c.Year)
            .ThenBy(c => c.Cohort)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var cycleIds = cycles.Select(c => c.Id).ToList();
        var applicantCounts = await db.Applicants
            .AsNoTracking()
            .Where(a => cycleIds.Contains(a.CycleId))
            .GroupBy(a => a.CycleId)
            .Select(g => new { CycleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CycleId, x => x.Count, ct);

        var dtos = cycles.Select(c => new CycleListItemDto(
            c.Id, c.NameAr, c.Year, c.Cohort,
            c.Status.ToString().ToLowerInvariant(),
            c.OpenDate, c.CloseDate,
            applicantCounts.GetValueOrDefault(c.Id, 0))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)pageSize);
        return new PagedResult<CycleListItemDto>(dtos, page, pageSize, total, totalPages);
    }
}
