using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Nationalities;

public static class NationalityMapper
{
    public static NationalityDto ToDto(Nationality x) => new(
        x.Id, x.Key, x.NameAr, x.NameEn, x.IsoCode,
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListNationalitiesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<NationalityDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Nationalities.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.NameEn.Contains(s) || x.IsoCode.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => NationalityMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<NationalityDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetNationalityUseCase(IPaDbContext db)
{
    public async Task<NationalityDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Nationalities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : NationalityMapper.ToDto(e);
    }
}

public sealed class CreateNationalityUseCase(IPaDbContext db)
{
    public async Task<NationalityDto> ExecuteAsync(CreateNationalityRequest req, CancellationToken ct = default)
    {
        if (await db.Nationalities.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Nationality with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Nationalities.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Nationality.Create(req.Key, req.NameAr, req.NameEn, req.IsoCode, sortOrder);
        db.Nationalities.Add(e);
        await db.SaveChangesAsync(ct);
        return NationalityMapper.ToDto(e);
    }
}

public sealed class UpdateNationalityUseCase(IPaDbContext db)
{
    public async Task<NationalityDto?> ExecuteAsync(Guid id, UpdateNationalityRequest req, CancellationToken ct = default)
    {
        var e = await db.Nationalities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.NameAr, req.NameEn, req.IsoCode, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return NationalityMapper.ToDto(e);
    }
}

public sealed class ArchiveNationalityUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Nationalities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreNationalityUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Nationalities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
