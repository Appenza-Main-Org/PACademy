using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Application.Dtos;
using PACademy.Modules.ReferenceData.Domain;

namespace PACademy.Modules.ReferenceData.Application.Admin;

public sealed class GetReferenceDataUseCase(IReferenceDataDbContext db)
{
    public async Task<ReferenceDataDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await db.ReferenceDataEntries.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        return entry is null ? null : MapToDetail(entry);
    }

    internal static ReferenceDataDetailDto MapToDetail(ReferenceDataEntry r)
        => new(
            r.Id, r.Category, r.Key, r.NameAr, r.NameEn,
            r.Metadata, r.SortOrder, r.IsActive, r.Archived,
            r.CreatedAt, r.ArchivedAt, r.DemoOrigin);
}
