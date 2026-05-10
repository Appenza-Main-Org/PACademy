using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.ExamGroups;

public static class ExamGroupMapper
{
    public static ExamGroupDto ToDto(ExamGroup x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListExamGroupsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<ExamGroupDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.ExamGroups.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => ExamGroupMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<ExamGroupDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetExamGroupUseCase(IPaDbContext db)
{
    public async Task<ExamGroupDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.ExamGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? ExamGroupMapper.ToDto(e) : null;
}

public sealed class CreateExamGroupUseCase(IPaDbContext db)
{
    public async Task<ExamGroupDto> ExecuteAsync(CreateExamGroupRequest req, CancellationToken ct = default)
    {
        if (await db.ExamGroups.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"ExamGroup with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.ExamGroups.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = ExamGroup.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.ExamGroups.Add(e); await db.SaveChangesAsync(ct);
        return ExamGroupMapper.ToDto(e);
    }
}

public sealed class UpdateExamGroupUseCase(IPaDbContext db)
{
    public async Task<ExamGroupDto?> ExecuteAsync(Guid id, UpdateExamGroupRequest req, CancellationToken ct = default)
    {
        var e = await db.ExamGroups.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return ExamGroupMapper.ToDto(e);
    }
}

public sealed class ArchiveExamGroupUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.ExamGroups.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreExamGroupUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.ExamGroups.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
