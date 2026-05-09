using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Infrastructure.Persistence;
using PACademy.Modules.ReferenceData.Public;

namespace PACademy.Modules.ReferenceData.Infrastructure;

internal sealed class ReferenceDataApiService(ReferenceDataDbContext db) : IReferenceDataApi
{
    public async Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(
        string category,
        CancellationToken ct = default)
    {
        return await db.ReferenceDataEntries
            .Where(r => r.Category == category && r.IsActive)
            .OrderBy(r => r.SortOrder).ThenBy(r => r.NameAr)
            .Select(r => new ReferenceDataItemDto(
                r.Id, r.Category, r.Key, r.NameAr, r.NameEn,
                r.Metadata, r.SortOrder, r.IsActive))
            .ToListAsync(ct);
    }

    public async Task<ReferenceDataItemDto?> FindByKeyAsync(
        string category,
        string key,
        CancellationToken ct = default)
    {
        var r = await db.ReferenceDataEntries
            .FirstOrDefaultAsync(e => e.Category == category && e.Key == key && e.IsActive, ct);
        return r is null
            ? null
            : new ReferenceDataItemDto(r.Id, r.Category, r.Key, r.NameAr, r.NameEn,
                r.Metadata, r.SortOrder, r.IsActive);
    }
}
