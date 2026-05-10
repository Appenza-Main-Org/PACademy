using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.DegreeTypes;

public static class DegreeTypeMapper
{
    public static DegreeTypeDto ToDto(DegreeType x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListDegreeTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<DegreeTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.DegreeTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => DegreeTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<DegreeTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetDegreeTypeUseCase(IPaDbContext db)
{
    public async Task<DegreeTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.DegreeTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? DegreeTypeMapper.ToDto(e) : null;
}

public sealed class CreateDegreeTypeUseCase(IPaDbContext db)
{
    public async Task<DegreeTypeDto> ExecuteAsync(CreateDegreeTypeRequest req, CancellationToken ct = default)
    {
        if (await db.DegreeTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"DegreeType with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.DegreeTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = DegreeType.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.DegreeTypes.Add(e); await db.SaveChangesAsync(ct);
        return DegreeTypeMapper.ToDto(e);
    }
}

public sealed class UpdateDegreeTypeUseCase(IPaDbContext db)
{
    public async Task<DegreeTypeDto?> ExecuteAsync(Guid id, UpdateDegreeTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.DegreeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return DegreeTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveDegreeTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.DegreeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreDegreeTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.DegreeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
