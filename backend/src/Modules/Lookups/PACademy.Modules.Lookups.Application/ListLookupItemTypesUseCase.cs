using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Lookups.Public;

namespace PACademy.Modules.Lookups.Application;

public sealed class ListLookupItemTypesUseCase(ILookupsDbContext db)
{
    public async Task<IReadOnlyList<LookupItemTypeDto>> ExecuteAsync(
        bool adminOnly, CancellationToken ct = default)
    {
        var q = db.LookupItemTypes.AsNoTracking();
        if (adminOnly) q = q.Where(t => t.IsAdminUi);
        var rows = await q
            .OrderBy(t => t.SectionKey).ThenBy(t => t.SortInSection)
            .ToListAsync(ct);
        return rows.Select(LookupItemMapper.ToDto).ToList();
    }
}
