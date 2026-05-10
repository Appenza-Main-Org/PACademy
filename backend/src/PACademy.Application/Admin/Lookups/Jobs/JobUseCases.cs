using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Jobs;

public static class JobMapper
{
    public static JobDto ToDto(Job x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListJobsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<JobDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Jobs.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => JobMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<JobDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetJobUseCase(IPaDbContext db)
{
    public async Task<JobDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.Jobs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? JobMapper.ToDto(e) : null;
}

public sealed class CreateJobUseCase(IPaDbContext db)
{
    public async Task<JobDto> ExecuteAsync(CreateJobRequest req, CancellationToken ct = default)
    {
        if (await db.Jobs.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Job with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Jobs.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Job.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.Jobs.Add(e); await db.SaveChangesAsync(ct);
        return JobMapper.ToDto(e);
    }
}

public sealed class UpdateJobUseCase(IPaDbContext db)
{
    public async Task<JobDto?> ExecuteAsync(Guid id, UpdateJobRequest req, CancellationToken ct = default)
    {
        var e = await db.Jobs.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return JobMapper.ToDto(e);
    }
}

public sealed class ArchiveJobUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Jobs.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreJobUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Jobs.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
