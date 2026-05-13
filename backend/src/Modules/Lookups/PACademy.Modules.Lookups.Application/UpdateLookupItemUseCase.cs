using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Public;
using PACademy.Modules.Lookups.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Lookups.Application;

public sealed class UpdateLookupItemUseCase(ILookupsDbContext db, IIdentityApi identity)
{
    public async Task<LookupItemDto?> ExecuteAsync(
        string typeCode, string code, UpdateLookupItemRequest request, CancellationToken ct = default)
    {
        var item = await db.LookupItems.FirstOrDefaultAsync(
            i => i.LookupTypeCode == typeCode && i.Code == code && i.DeletedAt == null, ct);
        if (item is null) return null;

        var rv = Convert.FromBase64String(request.RowVersion);
        db.Entry(item).Property(i => i.RowVersion).OriginalValue = rv;

        var type = await db.LookupItemTypes.FirstAsync(t => t.Code == typeCode, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var now = DateTimeOffset.UtcNow;

        item.Update(
            request.NameAr ?? item.NameAr,
            request.NameEn,
            request.SortOrder ?? item.SortOrder,
            type.IsHierarchical ? request.ParentId : null,
            type.HasDates ? request.StartDate : null,
            type.HasDates ? request.EndDate : null,
            request.ExtrasJson ?? item.ExtrasJson,
            typeCode == "SPECIALIZATIONS" ? request.FacultyCode : null,
            actor.Id,
            now);

        if (request.IsActive.HasValue)
            item.SetActive(request.IsActive.Value, actor.Id, now);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new DomainConflictException("تم تعديل البيانات من جهة أخرى", "ROW_VERSION_MISMATCH");
        }

        return LookupItemMapper.ToDto(item);
    }
}
