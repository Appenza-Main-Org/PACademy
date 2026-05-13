using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Lookups.Public;

namespace PACademy.Modules.Lookups.Application;

public sealed class ListLookupItemsUseCase(ILookupsDbContext db)
{
    public async Task<IReadOnlyList<LookupItemDto>> ExecuteAsync(
        string typeCode,
        bool includeInactive,
        bool includeDeleted,
        CancellationToken ct = default)
    {
        var q = db.LookupItems.AsNoTracking().Where(i => i.LookupTypeCode == typeCode);
        if (!includeDeleted) q = q.Where(i => i.DeletedAt == null);
        if (!includeInactive) q = q.Where(i => i.IsActive);

        var rows = await q
            .OrderBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(LookupItemMapper.ToDto).ToList();
    }
}
