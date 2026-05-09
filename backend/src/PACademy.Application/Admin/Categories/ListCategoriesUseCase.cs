using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Categories;

namespace PACademy.Application.Admin.Categories;

public sealed class ListCategoriesUseCase(IPaDbContext db)
{
    public async Task<List<CategoryListItemDto>> ExecuteAsync(
        bool includeArchived = false,
        CancellationToken ct = default)
    {
        var query = db.Categories.AsNoTracking();
        if (!includeArchived) query = query.Where(c => !c.Archived);

        return await query
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.NameAr)
            .Select(c => new CategoryListItemDto(
                c.Id, c.Key, c.NameAr, c.NameEn, c.SortOrder, c.IsActive, c.IsSpec))
            .ToListAsync(ct);
    }
}
