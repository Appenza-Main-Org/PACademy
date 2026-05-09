using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Application.Dtos;

namespace PACademy.Modules.ReferenceData.Application.Admin;

public sealed class UpdateReferenceDataUseCase(IReferenceDataDbContext db)
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
