using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Common;
using PACademy.Domain.Applicants;

namespace PACademy.Application.Admin.Applicants;

public sealed class ListApplicantsUseCase(IPaDbContext db)
{
    private const int MaxPageSize = 200;

    public async Task<PagedResult<ApplicantListItemDto>> ExecuteAsync(
        ApplicantListFilters filters,
        CancellationToken ct = default)
    {
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, MaxPageSize);

        var query = db.Applicants.AsNoTracking().Where(a => !a.Archived);

        if (filters.CycleId is { } cycleId)
            query = query.Where(a => a.CycleId == cycleId);

        if (!string.IsNullOrWhiteSpace(filters.Status) &&
            Enum.TryParse<ApplicantStatus>(filters.Status, ignoreCase: true, out var status))
            query = query.Where(a => a.Status == status);

        if (!string.IsNullOrWhiteSpace(filters.Q))
        {
            var q = filters.Q.Trim();
            query = query.Where(a => a.FullName.Contains(q) || a.NationalId.Contains(q));
        }

        var total = await query.CountAsync(ct);

        query = (filters.SortBy?.ToLowerInvariant(), filters.SortDir?.ToLowerInvariant()) switch
        {
            ("fullname", "desc") => query.OrderByDescending(a => a.FullName),
            ("fullname", _) => query.OrderBy(a => a.FullName),
            ("status", "desc") => query.OrderByDescending(a => a.Status),
            ("status", _) => query.OrderBy(a => a.Status),
            ("createdat", "asc") => query.OrderBy(a => a.CreatedAt),
            (_, _) => query.OrderByDescending(a => a.CreatedAt),
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new ApplicantListItemDto(
                a.Id,
                a.NationalId,
                a.FullName,
                a.CycleId,
                a.Status.ToString(),
                a.Governorate,
                a.Mobile,
                a.CreatedAt,
                a.UpdatedAt,
                a.DemoOrigin))
            .ToListAsync(ct);

        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize);

        return new PagedResult<ApplicantListItemDto>(items, page, pageSize, total, totalPages);
    }
}
