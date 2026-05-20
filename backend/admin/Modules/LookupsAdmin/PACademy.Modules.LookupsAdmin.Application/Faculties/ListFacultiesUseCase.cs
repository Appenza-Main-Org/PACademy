using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public sealed record ListFacultiesFilters(bool? IsActive, string? Search);

/// <summary>
/// Lists faculties for the admin /admin/lookups/faculties grid.
/// Filters: <c>isActive</c> toggle + free-text search across name/code.
/// </summary>
public sealed class ListFacultiesUseCase(ILookupsAdminDbContext db)
{
    public async Task<IReadOnlyList<FacultyAdminDto>> ExecuteAsync(
        ListFacultiesFilters filters,
        CancellationToken ct = default)
    {
        IQueryable<Faculty> q = db.Faculties.AsNoTracking();

        if (filters.IsActive.HasValue)
            q = q.Where(f => f.IsActive == filters.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim();
            q = q.Where(f => EF.Functions.Like(f.Name, $"%{s}%") || EF.Functions.Like(f.Code, $"%{s}%"));
        }

        return await q
            .OrderBy(f => f.Code)
            .Select(f => new FacultyAdminDto(
                f.Code,
                f.Name,
                f.IsActive,
                f.CreatedAt,
                f.UpdatedAt,
                Convert.ToBase64String(f.RowVersion)))
            .ToListAsync(ct);
    }
}
