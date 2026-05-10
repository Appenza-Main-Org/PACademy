using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.Specialties;

public static class SpecialtyMapper
{
    public static SpecialtyDto ToDto(Specialty x) => new(
        x.Id, x.Key, x.LabelAr, x.LabelEn, x.SpecialtyTypeId, x.Gender?.ToString(),
        x.SortOrder, x.IsActive, x.IsSystem, x.Archived, x.ArchivedAt, x.CreatedAt);

    public static SpecialtyGender? ParseGender(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return Enum.TryParse<SpecialtyGender>(s, ignoreCase: true, out var g) ? g
            : throw new DomainConflictException($"Unknown gender '{s}'.", "INVALID_GENDER");
    }
}

public sealed class ListSpecialtiesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<SpecialtyDto>> ExecuteAsync(SpecialtyListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.Specialties.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (f.SpecialtyTypeId.HasValue) q = q.Where(x => x.SpecialtyTypeId == f.SpecialtyTypeId.Value);
        if (!string.IsNullOrWhiteSpace(f.Gender))
        {
            var g = SpecialtyMapper.ParseGender(f.Gender);
            q = q.Where(x => x.Gender == null || x.Gender == g);
        }
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.LabelAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => SpecialtyMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<SpecialtyDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetSpecialtyUseCase(IPaDbContext db)
{
    public async Task<SpecialtyDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
        => (await db.Specialties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct))
            is { } e ? SpecialtyMapper.ToDto(e) : null;
}

public sealed class CreateSpecialtyUseCase(IPaDbContext db)
{
    public async Task<SpecialtyDto> ExecuteAsync(CreateSpecialtyRequest req, CancellationToken ct = default)
    {
        if (await db.Specialties.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Specialty with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        if (!await db.SpecialtyTypes.AnyAsync(s => s.Id == req.SpecialtyTypeId && !s.Archived, ct))
            throw new DomainConflictException("SpecialtyType not found.", "NOT_FOUND");
        var sortOrder = req.SortOrder ?? ((await db.Specialties.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = Specialty.Create(req.Key, req.LabelAr, req.SpecialtyTypeId,
            SpecialtyMapper.ParseGender(req.Gender), req.LabelEn, sortOrder);
        db.Specialties.Add(e); await db.SaveChangesAsync(ct);
        return SpecialtyMapper.ToDto(e);
    }
}

public sealed class UpdateSpecialtyUseCase(IPaDbContext db)
{
    public async Task<SpecialtyDto?> ExecuteAsync(Guid id, UpdateSpecialtyRequest req, CancellationToken ct = default)
    {
        var e = await db.Specialties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (req.SpecialtyTypeId.HasValue &&
            !await db.SpecialtyTypes.AnyAsync(s => s.Id == req.SpecialtyTypeId.Value && !s.Archived, ct))
            throw new DomainConflictException("SpecialtyType not found.", "NOT_FOUND");
        var gender = SpecialtyMapper.ParseGender(req.Gender);
        e.Update(req.LabelAr, req.LabelEn, req.SpecialtyTypeId, gender, req.ClearGender ?? false, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return SpecialtyMapper.ToDto(e);
    }
}

public sealed class ArchiveSpecialtyUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Specialties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreSpecialtyUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.Specialties.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false; e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
