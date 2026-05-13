using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Lookups.Application;

public sealed class SoftDeleteLookupItemUseCase(ILookupsDbContext db, IIdentityApi identity)
{
    public async Task<bool> ExecuteAsync(
        string typeCode, string code, SoftDeleteLookupItemRequest request, CancellationToken ct = default)
    {
        var item = await db.LookupItems.FirstOrDefaultAsync(
            i => i.LookupTypeCode == typeCode && i.Code == code && i.DeletedAt == null, ct);
        if (item is null) return false;

        var rv = Convert.FromBase64String(request.RowVersion);
        db.Entry(item).Property(i => i.RowVersion).OriginalValue = rv;

        var actor = (await identity.GetCurrentUserAsync(ct))!;
        item.SoftDelete(actor.Id, request.Reason, DateTimeOffset.UtcNow);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new DomainConflictException("تم تعديل البيانات من جهة أخرى", "ROW_VERSION_MISMATCH");
        }

        return true;
    }
}
