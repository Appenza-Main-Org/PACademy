using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.CommitteeTypes;

public static class CommitteeTypeMapper
{
    public static CommitteeTypeDto ToDto(CommitteeType x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListCommitteeTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<CommitteeTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.CommitteeTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => CommitteeTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<CommitteeTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetCommitteeTypeUseCase(IPaDbContext db)
{
    public async Task<CommitteeTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.CommitteeTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? CommitteeTypeMapper.ToDto(e) : null;
}

public sealed class CreateCommitteeTypeUseCase(IPaDbContext db)
{
    public async Task<CommitteeTypeDto> ExecuteAsync(CreateCommitteeTypeRequest req, CancellationToken ct = default)
    {
        if (await db.CommitteeTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"CommitteeType with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.CommitteeTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = CommitteeType.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.CommitteeTypes.Add(e); await db.SaveChangesAsync(ct);
        return CommitteeTypeMapper.ToDto(e);
    }
}

public sealed class UpdateCommitteeTypeUseCase(IPaDbContext db)
{
    public async Task<CommitteeTypeDto?> ExecuteAsync(Guid id, UpdateCommitteeTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.CommitteeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return CommitteeTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveCommitteeTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.CommitteeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreCommitteeTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.CommitteeTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
