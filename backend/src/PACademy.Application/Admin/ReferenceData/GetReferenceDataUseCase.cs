using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.ReferenceData;

namespace PACademy.Application.Admin.ReferenceData;

public sealed class GetReferenceDataUseCase(IPaDbContext db)
{
    public async Task<ReferenceDataDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await db.ReferenceDataEntries.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        return entry is null ? null : MapToDetail(entry);
    }

    internal static ReferenceDataDetailDto MapToDetail(Domain.ReferenceData.ReferenceDataEntry r)
        => new(
            r.Id, r.Category, r.Key, r.NameAr, r.NameEn,
            r.Metadata, r.SortOrder, r.IsActive, r.Archived,
            r.CreatedAt, r.ArchivedAt, r.DemoOrigin);
}
