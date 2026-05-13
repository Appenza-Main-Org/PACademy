using PACademy.Modules.Lookups.Domain;
using PACademy.Modules.Lookups.Public;

namespace PACademy.Modules.Lookups.Application;

internal static class LookupItemMapper
{
    internal static LookupItemDto ToDto(LookupItem i) => new(
        i.Id,
        i.LookupTypeCode,
        i.Code,
        i.NameAr,
        i.NameEn,
        i.IsActive,
        i.SortOrder,
        i.ParentId,
        i.StartDate,
        i.EndDate,
        i.ExtrasJson,
        i.FacultyCode,
        i.DeletedAt,
        i.CreatedAt,
        i.UpdatedAt,
        Convert.ToBase64String(i.RowVersion));

    internal static LookupItemTypeDto ToDto(LookupItemType t) => new(
        t.Code, t.LabelAr, t.CodePrefix, t.Padding, t.IsHierarchical,
        t.HasDates, t.HasExtras, t.SectionKey, t.SortInSection, t.IsAdminUi);
}
