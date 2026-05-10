using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Ranks;

public static class RankMapper
{
    public static RankDto ToDto(Rank x) => new(
        x.Id, x.Key, x.NameAr, x.Level, x.ApplicableTo.ToString(),
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
    public static ApplicableTo ParseApplicableTo(string s) =>
        Enum.TryParse<ApplicableTo>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown applicableTo '{s}'.", "INVALID_APPLICABLE_TO");
}

public sealed class ListRanksUseCase(IPaDbContext db)
{
    public async Task<PagedResult<RankDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Ranks.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.Level);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => RankMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<RankDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetRankUseCase(IPaDbContext db)
{
    public async Task<RankDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Ranks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : RankMapper.ToDto(e);
    }
}

public sealed class CreateRankUseCase(IPaDbContext db)
{
    public async Task<RankDto> ExecuteAsync(CreateRankRequest req, CancellationToken ct = default)
    {
        if (await db.Ranks.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Rank with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Ranks.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Rank.Create(req.Key, req.NameAr, req.Level, RankMapper.ParseApplicableTo(req.ApplicableTo), sortOrder);
        db.Ranks.Add(e);
        await db.SaveChangesAsync(ct);
        return RankMapper.ToDto(e);
    }
}

public sealed class UpdateRankUseCase(IPaDbContext db)
{
    public async Task<RankDto?> ExecuteAsync(Guid id, UpdateRankRequest req, CancellationToken ct = default)
    {
        var e = await db.Ranks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        ApplicableTo? at = req.ApplicableTo is null ? null : RankMapper.ParseApplicableTo(req.ApplicableTo);
        e.Update(req.NameAr, req.Level, at, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return RankMapper.ToDto(e);
    }
}

public sealed class ArchiveRankUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Ranks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreRankUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Ranks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
