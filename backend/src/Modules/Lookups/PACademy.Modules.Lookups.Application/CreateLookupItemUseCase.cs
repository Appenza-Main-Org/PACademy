using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Public;
using PACademy.Modules.Lookups.Domain;
using PACademy.Modules.Lookups.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Lookups.Application;

public sealed class CreateLookupItemUseCase(ILookupsDbContext db, IIdentityApi identity)
{
    public async Task<LookupItemDto> ExecuteAsync(
        string typeCode, CreateLookupItemRequest request, CancellationToken ct = default)
    {
        var type = await db.LookupItemTypes.FirstOrDefaultAsync(t => t.Code == typeCode, ct)
            ?? throw new DomainConflictException("نوع البيانات غير معروف", "UNKNOWN_TYPE");

        var duplicate = await db.LookupItems.AnyAsync(
            i => i.LookupTypeCode == typeCode && i.Code == request.Code && i.DeletedAt == null, ct);
        if (duplicate)
            throw new DomainConflictException("هذا الكود مستخدم بالفعل ضمن هذا الجدول", "DUPLICATE_CODE");

        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var now = DateTimeOffset.UtcNow;

        var item = LookupItem.Create(
            Guid.NewGuid(),
            typeCode,
            request.Code,
            request.NameAr,
            request.NameEn,
            request.SortOrder,
            type.IsHierarchical ? request.ParentId : null,
            type.HasDates ? request.StartDate : null,
            type.HasDates ? request.EndDate : null,
            request.ExtrasJson ?? "{}",
            typeCode == "SPECIALIZATIONS" ? request.FacultyCode : null,
            actor.Id,
            now);

        db.LookupItems.Add(item);
        await db.SaveChangesAsync(ct);

        return LookupItemMapper.ToDto(item);
    }
}
