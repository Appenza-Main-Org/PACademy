using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.RejectionReasons;

public static class RejectionReasonMapper
{
    public static RejectionReasonDto ToDto(RejectionReason x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListRejectionReasonsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<RejectionReasonDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.RejectionReasons.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => RejectionReasonMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<RejectionReasonDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetRejectionReasonUseCase(IPaDbContext db)
{
    public async Task<RejectionReasonDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.RejectionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? RejectionReasonMapper.ToDto(e) : null;
}

public sealed class CreateRejectionReasonUseCase(IPaDbContext db)
{
    public async Task<RejectionReasonDto> ExecuteAsync(CreateRejectionReasonRequest req, CancellationToken ct = default)
    {
        if (await db.RejectionReasons.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"RejectionReason with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.RejectionReasons.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = RejectionReason.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.RejectionReasons.Add(e); await db.SaveChangesAsync(ct);
        return RejectionReasonMapper.ToDto(e);
    }
}

public sealed class UpdateRejectionReasonUseCase(IPaDbContext db)
{
    public async Task<RejectionReasonDto?> ExecuteAsync(Guid id, UpdateRejectionReasonRequest req, CancellationToken ct = default)
    {
        var e = await db.RejectionReasons.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return RejectionReasonMapper.ToDto(e);
    }
}

public sealed class ArchiveRejectionReasonUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.RejectionReasons.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreRejectionReasonUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.RejectionReasons.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
