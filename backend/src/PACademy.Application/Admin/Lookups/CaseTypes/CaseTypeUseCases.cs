using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;
using PACademy.Domain.Lookups;

namespace PACademy.Application.Admin.Lookups.CaseTypes;

public static class CaseTypeMapper
{
    public static CaseTypeDto ToDto(CaseType x) => new(
        x.Id, x.Key, x.NameAr, x.Severity.ToString(), x.BlocksApplication,
        x.SortOrder, x.IsActive, x.Archived, x.ArchivedAt, x.CreatedAt);
    public static CaseSeverity ParseSeverity(string s) =>
        Enum.TryParse<CaseSeverity>(s, ignoreCase: true, out var v) ? v
            : throw new DomainConflictException($"Unknown case severity '{s}'.", "INVALID_SEVERITY");
}

public sealed class ListCaseTypesUseCase(IPaDbContext db)
{
    public async Task<PagedResult<CaseTypeDto>> ExecuteAsync(LookupListFilters f, CancellationToken ct = default)
    {
        var page = Math.Max(1, f.Page); var pageSize = Math.Clamp(f.PageSize, 1, 500);
        var q = db.CaseTypes.AsNoTracking();
        if (!f.IncludeArchived) q = q.Where(x => !x.Archived);
        if (f.IsActive.HasValue) q = q.Where(x => x.IsActive == f.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var s = f.Q.Trim(); q = q.Where(x => x.NameAr.Contains(s) || x.Key.Contains(s)); }
        q = q.OrderBy(x => x.SortOrder).ThenBy(x => x.NameAr);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).Select(x => CaseTypeMapper.ToDto(x)).ToListAsync(ct);
        return new PagedResult<CaseTypeDto>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public sealed class GetCaseTypeUseCase(IPaDbContext db)
{
    public async Task<CaseTypeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.CaseTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : CaseTypeMapper.ToDto(e);
    }
}

public sealed class CreateCaseTypeUseCase(IPaDbContext db)
{
    public async Task<CaseTypeDto> ExecuteAsync(CreateCaseTypeRequest req, CancellationToken ct = default)
    {
        if (await db.CaseTypes.AnyAsync(x => x.Key == req.Key && !x.Archived, ct))
            throw new DomainConflictException($"Case type with key '{req.Key}' already exists.", "DUPLICATE_KEY");
        var sortOrder = req.SortOrder ?? ((await db.CaseTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1);
        var e = CaseType.Create(req.Key, req.NameAr, CaseTypeMapper.ParseSeverity(req.Severity), req.BlocksApplication, sortOrder);
        db.CaseTypes.Add(e);
        await db.SaveChangesAsync(ct);
        return CaseTypeMapper.ToDto(e);
    }
}

public sealed class UpdateCaseTypeUseCase(IPaDbContext db)
{
    public async Task<CaseTypeDto?> ExecuteAsync(Guid id, UpdateCaseTypeRequest req, CancellationToken ct = default)
    {
        var e = await db.CaseTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        CaseSeverity? sv = req.Severity is null ? null : CaseTypeMapper.ParseSeverity(req.Severity);
        e.Update(req.NameAr, sv, req.BlocksApplication, req.SortOrder, req.IsActive);
        await db.SaveChangesAsync(ct);
        return CaseTypeMapper.ToDto(e);
    }
}

public sealed class ArchiveCaseTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.CaseTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Archive(); await db.SaveChangesAsync(ct); return true;
    }
}

public sealed class RestoreCaseTypeUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.CaseTypes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;
        e.Restore(); await db.SaveChangesAsync(ct); return true;
    }
}
