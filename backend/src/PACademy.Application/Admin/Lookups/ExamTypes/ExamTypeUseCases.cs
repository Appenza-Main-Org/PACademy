using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.ExamTypes;

public static class ExamTypeMapper
{
    public static ExamTypeDto ToDto(ExamType x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListExamTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<ExamTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.ExamTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => ExamTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<ExamTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetExamTypeUseCase(IPaDbContext db)
{
    public async Task<ExamTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.ExamTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? ExamTypeMapper.ToDto(e) : null;
}

public sealed class CreateExamTypeUseCase(IPaDbContext db)
{
    public async Task<ExamTypeDto> ExecuteAsync(CreateExamTypeRequest req, CancellationToken ct = default)
    {
        if (await db.ExamTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"ExamType with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.ExamTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = ExamType.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.ExamTypes.Add(e); await db.SaveChangesAsync(ct);
        return ExamTypeMapper.ToDto(e);
    }
}

public sealed class UpdateExamTypeUseCase(IPaDbContext db)
{
    public async Task<ExamTypeDto?> ExecuteAsync(Guid id, UpdateExamTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.ExamTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return ExamTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveExamTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.ExamTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreExamTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.ExamTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
