using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.ReferenceData;

namespace PACademy.Application.Admin.ReferenceData;

public sealed class CreateReferenceDataUseCase(IPaDbContext db)
{
    public async Task<ReferenceDataDetailDto> ExecuteAsync(
        CreateReferenceDataRequest request,
        CancellationToken ct = default)
    {
        // FR-L02: duplicate (category, key) → REFERENCE_KEY_TAKEN
        var exists = await db.ReferenceDataEntries
            .AnyAsync(r => r.Category == request.Category
                        && r.Key == request.Key
                        && !r.Archived, ct);
        if (exists)
            throw new DomainConflictException(
                $"A reference entry with category '{request.Category}' and key '{request.Key}' already exists.",
                "REFERENCE_KEY_TAKEN");

        // SortOrder default: max(SortOrder) + 1 within the category
        var sortOrder = request.SortOrder ?? await NextSortOrderAsync(request.Category, ct);

        var entry = Domain.ReferenceData.ReferenceDataEntry.Create(
            request.Category,
            request.Key,
            request.NameAr,
            request.NameEn,
            request.Metadata,
            sortOrder);

        db.ReferenceDataEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        return GetReferenceDataUseCase.MapToDetail(entry);
    }

    private async Task<int> NextSortOrderAsync(string category, CancellationToken ct)
    {
        var max = await db.ReferenceDataEntries
            .Where(r => r.Category == category)
            .Select(r => (int?)r.SortOrder)
            .MaxAsync(ct);
        return (max ?? 0) + 1;
    }
}
