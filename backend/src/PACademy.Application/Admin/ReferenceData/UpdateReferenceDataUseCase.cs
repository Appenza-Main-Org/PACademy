using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.ReferenceData;

namespace PACademy.Application.Admin.ReferenceData;

public sealed class UpdateReferenceDataUseCase(IPaDbContext db)
{
    public async Task<ReferenceDataDetailDto?> ExecuteAsync(
        Guid id,
        UpdateReferenceDataRequest request,
        CancellationToken ct = default)
    {
        var entry = await db.ReferenceDataEntries.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entry is null) return null;

        entry.Update(
            request.NameAr,
            request.NameEn,
            request.Metadata,
            request.SortOrder,
            request.IsActive);

        await db.SaveChangesAsync(ct);
        return GetReferenceDataUseCase.MapToDetail(entry);
    }
}
