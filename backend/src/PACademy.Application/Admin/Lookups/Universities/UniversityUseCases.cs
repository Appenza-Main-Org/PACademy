using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Universities;

public static class UniversityMapper
{
    public static UniversityDto ToDto(University x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListUniversitiesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<UniversityDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Universities.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => UniversityMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<UniversityDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetUniversityUseCase(IPaDbContext db)
{
    public async Task<UniversityDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.Universities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? UniversityMapper.ToDto(e) : null;
}

public sealed class CreateUniversityUseCase(IPaDbContext db)
{
    public async Task<UniversityDto> ExecuteAsync(CreateUniversityRequest req, CancellationToken ct = default)
    {
        if (await db.Universities.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"University with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Universities.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = University.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.Universities.Add(e); await db.SaveChangesAsync(ct);
        return UniversityMapper.ToDto(e);
    }
}

public sealed class UpdateUniversityUseCase(IPaDbContext db)
{
    public async Task<UniversityDto?> ExecuteAsync(Guid id, UpdateUniversityRequest req, CancellationToken ct = default)
    {
        var e = await db.Universities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return UniversityMapper.ToDto(e);
    }
}

public sealed class ArchiveUniversityUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Universities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        // Block if any faculty depends on this university.
        if (await db.Faculties.AnyAsync(f => f.UniversityId == id && !f.Archived, ct))
            throw new DomainConflictException("Cannot archive — faculties reference this university.", "REFERENCE_IN_USE");
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreUniversityUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Universities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
