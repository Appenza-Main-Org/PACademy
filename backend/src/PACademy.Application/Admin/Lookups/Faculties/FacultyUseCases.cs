using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Faculties;

public static class FacultyMapper
{
    public static FacultyDto ToDto(Faculty x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.UniversityId, x.SortOrder, x.IsActive, x.IsSystem,
        x.Archived, x.ArchivedAt, x.CreatedAt);
}

public sealed class ListFacultiesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<FacultyDto>> ExecuteAsync(FacultyListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Faculties.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (f.UniversityId.HasValue) q = q.Where(x => x.UniversityId == f.UniversityId.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => FacultyMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<FacultyDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetFacultyUseCase(IPaDbContext db)
{
    public async Task<FacultyDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.Faculties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? FacultyMapper.ToDto(e) : null;
}

public sealed class CreateFacultyUseCase(IPaDbContext db)
{
    public async Task<FacultyDto> ExecuteAsync(CreateFacultyRequest req, CancellationToken ct = default)
    {
        if (await db.Faculties.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Faculty with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        if (!await db.Universities.AnyAsync(u => u.Id == req.UniversityId && !u.Archived, ct))
            throw new DomainConflictException("University not found.", "NOT_FOUND");
        var sortOrder = req.SortOrder ?? ((await db.Faculties.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Faculty.Create(req.Key, req.LabelAr, req.UniversityId, req.LabelEn, sortOrder);
        db.Faculties.Add(e); await db.SaveChangesAsync(ct);
        return FacultyMapper.ToDto(e);
    }
}

public sealed class UpdateFacultyUseCase(IPaDbContext db)
{
    public async Task<FacultyDto?> ExecuteAsync(Guid id, UpdateFacultyRequest req, CancellationToken ct = default)
    {
        var e = await db.Faculties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (req.UniversityId.HasValue &&
            !await db.Universities.AnyAsync(u => u.Id == req.UniversityId.Value && !u.Archived, ct))
            throw new DomainConflictException("University not found.", "NOT_FOUND");
        e.Update(req.LabelAr, req.LabelEn, req.UniversityId, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return FacultyMapper.ToDto(e);
    }
}

public sealed class ArchiveFacultyUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Faculties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreFacultyUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Faculties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
