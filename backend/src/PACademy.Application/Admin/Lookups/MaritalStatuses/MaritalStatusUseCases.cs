using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.MaritalStatuses;

public static class MaritalStatusMapper
{
    public static MaritalStatusDto ToDto(MaritalStatus x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListMaritalStatusesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<MaritalStatusDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.MaritalStatuses.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => MaritalStatusMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<MaritalStatusDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetMaritalStatusUseCase(IPaDbContext db)
{
    public async Task<MaritalStatusDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.MaritalStatuses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? MaritalStatusMapper.ToDto(e) : null;
}

public sealed class CreateMaritalStatusUseCase(IPaDbContext db)
{
    public async Task<MaritalStatusDto> ExecuteAsync(CreateMaritalStatusRequest req, CancellationToken ct = default)
    {
        if (await db.MaritalStatuses.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"MaritalStatus with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.MaritalStatuses.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = MaritalStatus.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.MaritalStatuses.Add(e); await db.SaveChangesAsync(ct);
        return MaritalStatusMapper.ToDto(e);
    }
}

public sealed class UpdateMaritalStatusUseCase(IPaDbContext db)
{
    public async Task<MaritalStatusDto?> ExecuteAsync(Guid id, UpdateMaritalStatusRequest req, CancellationToken ct = default)
    {
        var e = await db.MaritalStatuses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return MaritalStatusMapper.ToDto(e);
    }
}

public sealed class ArchiveMaritalStatusUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.MaritalStatuses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreMaritalStatusUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.MaritalStatuses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
