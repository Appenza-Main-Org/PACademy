using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.EducationTypes;

public static class EducationTypeMapper
{
    public static EducationTypeDto ToDto(EducationType x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListEducationTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<EducationTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.EducationTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => EducationTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<EducationTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetEducationTypeUseCase(IPaDbContext db)
{
    public async Task<EducationTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.EducationTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? EducationTypeMapper.ToDto(e) : null;
}

public sealed class CreateEducationTypeUseCase(IPaDbContext db)
{
    public async Task<EducationTypeDto> ExecuteAsync(CreateEducationTypeRequest req, CancellationToken ct = default)
    {
        if (await db.EducationTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"EducationType with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.EducationTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = EducationType.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.EducationTypes.Add(e); await db.SaveChangesAsync(ct);
        return EducationTypeMapper.ToDto(e);
    }
}

public sealed class UpdateEducationTypeUseCase(IPaDbContext db)
{
    public async Task<EducationTypeDto?> ExecuteAsync(Guid id, UpdateEducationTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.EducationTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return EducationTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveEducationTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.EducationTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreEducationTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.EducationTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
