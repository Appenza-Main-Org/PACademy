using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.SpecialtyTypes;

public static class SpecialtyTypeMapper
{
    public static SpecialtyTypeDto ToDto(SpecialtyType x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListSpecialtyTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<SpecialtyTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.SpecialtyTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => SpecialtyTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<SpecialtyTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetSpecialtyTypeUseCase(IPaDbContext db)
{
    public async Task<SpecialtyTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.SpecialtyTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? SpecialtyTypeMapper.ToDto(e) : null;
}

public sealed class CreateSpecialtyTypeUseCase(IPaDbContext db)
{
    public async Task<SpecialtyTypeDto> ExecuteAsync(CreateSpecialtyTypeRequest req, CancellationToken ct = default)
    {
        if (await db.SpecialtyTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"SpecialtyType with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.SpecialtyTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = SpecialtyType.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.SpecialtyTypes.Add(e); await db.SaveChangesAsync(ct);
        return SpecialtyTypeMapper.ToDto(e);
    }
}

public sealed class UpdateSpecialtyTypeUseCase(IPaDbContext db)
{
    public async Task<SpecialtyTypeDto?> ExecuteAsync(Guid id, UpdateSpecialtyTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.SpecialtyTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return SpecialtyTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveSpecialtyTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.SpecialtyTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        if (await db.Specialties.AnyAsync(s => s.SpecialtyTypeId == id && !s.Archived, ct))
            throw new DomainConflictException("Cannot archive — specialties reference this type.", "REFERENCE_IN_USE");
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreSpecialtyTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.SpecialtyTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
