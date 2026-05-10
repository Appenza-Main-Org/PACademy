using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Governorates;

public static class GovernorateMapper
{
    public static GovernorateDto ToDto(Governorate g) => new(
        g.Id, g.Key, g.NameAr, g.NameEn, g.Region.ToString(),
        g.SortOrder, g.IsActive, g.Archived, g.ArchivedAt, g.CreatedAt);

    public static GovernorateRegion ParseRegion(string s) =>
        Enum.TryParse<GovernorateRegion>(s, ignoreCase: true, out var r)
            ? r
            : throw new DomainConflictException($"Unknown region '{s}'.", "INVALID_REGION");
}

public sealed class ListGovernoratesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<GovernorateDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page);
        var pageSize = Math.Clamp(f.PageSize, 1, 500);

        var q = db.Governorates.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q))
        {
            var s = f.Q.Trim();
            q = q.Where(x => x.NameAr.Contains(s) || x.NameEn.Contains(s) || x.Key.Contains(s));
        }

        var dir = string.Equals(f.SortDir, "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc";
        q = (f.SortBy?.ToLowerInvariant(), dir) switch
        {
            ("namear", "desc") => q.OrderByDescending(x => x.NameAr),
            ("namear", _) => q.OrderBy(x => x.NameAr),
            (_, "desc") => q.OrderByDescending(x => x.SortOrder).ThenByDescending(x => x.NameAr),
            _ => q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr),
        };

        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => GovernorateMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<GovernorateDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetGovernorateUseCase(IPaDbContext db)
{
    public async Task<GovernorateDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Governorates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return entity is null ? null : GovernorateMapper.ToDto(entity);
    }
}

public sealed class CreateGovernorateUseCase(IPaDbContext db)
{
    public async Task<GovernorateDto> ExecuteAsync(CreateGovernorateRequest req, CancellationToken ct = default)
    {
        if (await db.Governorates.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Governorate with key '{req.Key}' already exists.", "DUPLICATE_KEY");

        var sortOrder = req.SortOrder ?? ((await db.Governorates.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var entity = Governorate.Create(req.Key, req.NameAr, req.NameEn,
            GovernorateMapper.ParseRegion(req.Region), sortOrder);
        db.Governorates.Add(entity);
        await db.SaveChangesAsync(ct);
        return GovernorateMapper.ToDto(entity);
    }
}

public sealed class UpdateGovernorateUseCase(IPaDbContext db)
{
    public async Task<GovernorateDto?> ExecuteAsync(Guid id, UpdateGovernorateRequest req, CancellationToken ct = default)
    {
        var entity = await db.Governorates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        GovernorateRegion? region = req.Region is null ? null : GovernorateMapper.ParseRegion(req.Region);
        entity.Update(req.NameAr, req.NameEn, region, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return GovernorateMapper.ToDto(entity);
    }
}

public sealed class ArchiveGovernorateUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Governorates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        // FR-L05: prevent archiving while child colleges still depend on it.
        var inUse = await db.Colleges.AnyAsync(c => c.GovernorateId == id && !c.Archived, ct);
        if (inUse)
            throw new DomainConflictException(
                "Cannot archive — colleges still reference this governorate.",
                "REFERENCE_IN_USE");

        entity.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed class RestoreGovernorateUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Governorates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;
        entity.Restore();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
