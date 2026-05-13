using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Lookups.Public;

namespace PACademy.Modules.Lookups.Application;

public sealed class GetLookupItemUseCase(ILookupsDbContext db)
{
    public async Task<LookupItemDto?> ExecuteAsync(
        string typeCode, string code, CancellationToken ct = default)
    {
        var item = await db.LookupItems.AsNoTracking()
            .FirstOrDefaultAsync(i =>
                i.LookupTypeCode == typeCode && i.Code == code && i.DeletedAt == null, ct);
        return item is null ? null : LookupItemMapper.ToDto(item);
    }
}
