using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Specializations;

public static class SpecializationMapper
{
    public static SpecializationDto ToDto(Specialization x) => new(
        x.Id, x.Key, x.NameAr, x.Code, x.FacultyType.ToString(),
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);

    public static FacultyType ParseFacultyType(string s) =>
        Enum.TryParse<FacultyType>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown facultyType '{s}'.", "INVALID_FACULTY_TYPE");
}

public sealed class ListSpecializationsUseCase(IPaDbContext db)
{
    public async Task<PagedResult<SpecializationDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Specializations.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q))
        {
            var s = f.Q.Trim();
            q = q.Where(x => x.NameAr.Contains(s) || x.Code.Contains(s) || x.Key.Contains(s));
        }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => SpecializationMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<SpecializationDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetSpecializationUseCase(IPaDbContext db)
{
    public async Task<SpecializationDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Specializations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : SpecializationMapper.ToDto(e);
    }
}

public sealed class CreateSpecializationUseCase(IPaDbContext db)
{
    public async Task<SpecializationDto> ExecuteAsync(CreateSpecializationRequest req, CancellationToken ct = default)
    {
        if (await db.Specializations.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Specialization with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.Specializations.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Specialization.Create(req.Key, req.NameAr, req.Code,
            SpecializationMapper.ParseFacultyType(req.FacultyType), sortOrder);
        db.Specializations.Add(e);
        await db.SaveChangesAsync(ct);
        return SpecializationMapper.ToDto(e);
    }
}

public sealed class UpdateSpecializationUseCase(IPaDbContext db)
{
    public async Task<SpecializationDto?> ExecuteAsync(Guid id, UpdateSpecializationRequest req, CancellationToken ct = default)
    {
        var e = await db.Specializations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        FacultyType? ft = req.FacultyType is null ? null : SpecializationMapper.ParseFacultyType(req.FacultyType);
        e.Update(req.NameAr, req.Code, ft, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return SpecializationMapper.ToDto(e);
    }
}

public sealed class ArchiveSpecializationUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Specializations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreSpecializationUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Specializations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
