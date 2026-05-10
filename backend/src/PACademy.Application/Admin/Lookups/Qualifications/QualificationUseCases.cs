using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Qualifications;

public static class QualificationMapper
{
    public static QualificationDto ToDto(Qualification x) => new(
        x.Id, x.Key, x.NameAr, x.Level.ToString(), x.FacultyRequired,
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
    public static QualificationLevel ParseLevel(string s) =>
        Enum.TryParse<QualificationLevel>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown qualification level '{s}'.", "INVALID_LEVEL");
}

public sealed class ListQualificationsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<QualificationDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Qualifications.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => QualificationMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<QualificationDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetQualificationUseCase(IPaDbContext db)
{
    public async Task<QualificationDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Qualifications.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : QualificationMapper.ToDto(e);
    }
}

public sealed class CreateQualificationUseCase(IPaDbContext db)
{
    public async Task<QualificationDto> ExecuteAsync(CreateQualificationRequest req, CancellationToken ct = default)
    {
        if (await db.Qualifications.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Qualification with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Qualifications.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Qualification.Create(req.Key, req.NameAr, QualificationMapper.ParseLevel(req.Level), req.FacultyRequired, sortOrder);
        db.Qualifications.Add(e);
        await db.SaveChangesAsync(ct);
        return QualificationMapper.ToDto(e);
    }
}

public sealed class UpdateQualificationUseCase(IPaDbContext db)
{
    public async Task<QualificationDto?> ExecuteAsync(Guid id, UpdateQualificationRequest req, CancellationToken ct = default)
    {
        var e = await db.Qualifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        QualificationLevel? lvl = req.Level is null ? null : QualificationMapper.ParseLevel(req.Level);
        e.Update(req.NameAr, lvl, req.FacultyRequired, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return QualificationMapper.ToDto(e);
    }
}

public sealed class ArchiveQualificationUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Qualifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreQualificationUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Qualifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
