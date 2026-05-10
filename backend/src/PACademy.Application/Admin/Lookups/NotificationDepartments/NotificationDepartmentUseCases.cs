using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.NotificationDepartments;

public static class NotificationDepartmentMapper
{
    public static NotificationDepartmentDto ToDto(NotificationDepartment x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListNotificationDepartmentsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<NotificationDepartmentDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.NotificationDepartments.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => NotificationDepartmentMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<NotificationDepartmentDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetNotificationDepartmentUseCase(IPaDbContext db)
{
    public async Task<NotificationDepartmentDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.NotificationDepartments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? NotificationDepartmentMapper.ToDto(e) : null;
}

public sealed class CreateNotificationDepartmentUseCase(IPaDbContext db)
{
    public async Task<NotificationDepartmentDto> ExecuteAsync(CreateNotificationDepartmentRequest req, CancellationToken ct = default)
    {
        if (await db.NotificationDepartments.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"NotificationDepartment with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.NotificationDepartments.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = NotificationDepartment.Create(req.Key, req.LabelAr, req.LabelEn, sortOrder);
        db.NotificationDepartments.Add(e); await db.SaveChangesAsync(ct);
        return NotificationDepartmentMapper.ToDto(e);
    }
}

public sealed class UpdateNotificationDepartmentUseCase(IPaDbContext db)
{
    public async Task<NotificationDepartmentDto?> ExecuteAsync(Guid id, UpdateNotificationDepartmentRequest req, CancellationToken ct = default)
    {
        var e = await db.NotificationDepartments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        e.Update(req.LabelAr, req.LabelEn, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return NotificationDepartmentMapper.ToDto(e);
    }
}

public sealed class ArchiveNotificationDepartmentUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.NotificationDepartments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreNotificationDepartmentUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.NotificationDepartments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
