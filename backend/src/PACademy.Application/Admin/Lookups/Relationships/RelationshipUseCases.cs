using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Relationships;

public static class RelationshipMapper
{
    public static RelationshipDto ToDto(Relationship x) => new(
        x.Id, x.Key, x.NameAr, x.Degree, x.Side.ToString(),
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
    public static RelationshipSide ParseSide(string s) =>
        Enum.TryParse<RelationshipSide>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown relationship side '{s}'.", "INVALID_SIDE");
}

public sealed class ListRelationshipsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<RelationshipDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Relationships.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.Degree);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => RelationshipMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<RelationshipDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetRelationshipUseCase(IPaDbContext db)
{
    public async Task<RelationshipDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Relationships.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : RelationshipMapper.ToDto(e);
    }
}

public sealed class CreateRelationshipUseCase(IPaDbContext db)
{
    public async Task<RelationshipDto> ExecuteAsync(CreateRelationshipRequest req, CancellationToken ct = default)
    {
        if (await db.Relationships.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Relationship with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Relationships.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Relationship.Create(req.Key, req.NameAr, req.Degree, RelationshipMapper.ParseSide(req.Side), sortOrder);
        db.Relationships.Add(e);
        await db.SaveChangesAsync(ct);
        return RelationshipMapper.ToDto(e);
    }
}

public sealed class UpdateRelationshipUseCase(IPaDbContext db)
{
    public async Task<RelationshipDto?> ExecuteAsync(Guid id, UpdateRelationshipRequest req, CancellationToken ct = default)
    {
        var e = await db.Relationships.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        RelationshipSide? sd = req.Side is null ? null : RelationshipMapper.ParseSide(req.Side);
        e.Update(req.NameAr, req.Degree, sd, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return RelationshipMapper.ToDto(e);
    }
}

public sealed class ArchiveRelationshipUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Relationships.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreRelationshipUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Relationships.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
