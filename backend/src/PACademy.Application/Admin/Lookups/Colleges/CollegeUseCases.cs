using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Colleges;

public static class CollegeMapper
{
    public static CollegeDto ToDto(College x) => new(
        x.Id, x.Key, x.NameAr, x.GovernorateId, x.Type.ToString(),
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
    public static CollegeType ParseType(string s) =>
        Enum.TryParse<CollegeType>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown college type '{s}'.", "INVALID_COLLEGE_TYPE");
}

public sealed class ListCollegesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<CollegeDto>> ExecuteAsync(CollegeListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Colleges.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (f.GovernorateId.HasValue) q = q.Where(x => x.GovernorateId == f.GovernorateId.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => CollegeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<CollegeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetCollegeUseCase(IPaDbContext db)
{
    public async Task<CollegeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Colleges.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : CollegeMapper.ToDto(e);
    }
}

public sealed class CreateCollegeUseCase(IPaDbContext db)
{
    public async Task<CollegeDto> ExecuteAsync(CreateCollegeRequest req, CancellationToken ct = default)
    {
        if (await db.Colleges.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"College with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        if (!await db.Governorates.AnyAsync(g => g.Id == req.GovernorateId && !g.Archived, ct))
            throw new DomainConflictException("Governorate not found.", "NOT_FOUND");
        var sortOrder = req.SortOrder ?? ((await db.Colleges.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = College.Create(req.Key, req.NameAr, req.GovernorateId, CollegeMapper.ParseType(req.Type), sortOrder);
        db.Colleges.Add(e);
        await db.SaveChangesAsync(ct);
        return CollegeMapper.ToDto(e);
    }
}

public sealed class UpdateCollegeUseCase(IPaDbContext db)
{
    public async Task<CollegeDto?> ExecuteAsync(Guid id, UpdateCollegeRequest req, CancellationToken ct = default)
    {
        var e = await db.Colleges.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (req.GovernorateId.HasValue &&
            !await db.Governorates.AnyAsync(g => g.Id == req.GovernorateId.Value && !g.Archived, ct))
            throw new DomainConflictException("Governorate not found.", "NOT_FOUND");
        CollegeType? t = req.Type is null ? null : CollegeMapper.ParseType(req.Type);
        e.Update(req.NameAr, req.GovernorateId, t, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return CollegeMapper.ToDto(e);
    }
}

public sealed class ArchiveCollegeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Colleges.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreCollegeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Colleges.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
