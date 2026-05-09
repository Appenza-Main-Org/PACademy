using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Application.Dtos;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.ReferenceData.Application.Admin;

public sealed class ListReferenceDataUseCase(IReferenceDataDbContext db)
{
    public async Task<PagedResult<ReferenceDataListItemDto>> ExecuteAsync(
        ReferenceDataListFilters filters,
        CancellationToken ct = default)
    {
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 200);

        var query = db.ReferenceDataEntries.AsNoTracking();

        if (!filters.IncludeArchived)
            query = query.Where(r => !r.Archived);

        if (!string.IsNullOrWhiteSpace(filters.Category))
            query = query.Where(r => r.Category == filters.Category);

        if (filters.IsActive.HasValue)
            query = query.Where(r => r.IsActive == filters.IsActive.Value);

        var sortDir = string.Equals(filters.SortDir, "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc";
        query = (filters.SortBy, sortDir) switch
        {
            ("nameAr", "desc") => query.OrderByDescending(r => r.NameAr),
            ("nameAr", _) => query.OrderBy(r => r.NameAr),
            (_, "desc") => query.OrderByDescending(r => r.SortOrder).ThenByDescending(r => r.NameAr),
            _ => query.OrderBy(r => r.SortOrder).ThenBy(r => r.NameAr),
        };

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReferenceDataListItemDto(
                r.Id, r.Category, r.Key, r.NameAr, r.NameEn,
                r.SortOrder, r.IsActive, r.Archived))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(total / (double)pageSize);
        return new PagedResult<ReferenceDataListItemDto>(items, page, pageSize, total, totalPages);
    }
}
