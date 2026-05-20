using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.LookupsRead.Application;

/// <summary>
/// Lists all active faculties for the applicant-facing dropdowns
/// (bachelor block on Stage345, family qualification picker, etc.).
///
/// Ordering by Arabic name for natural display; downstream callers
/// don't paginate (the full set is 18 rows).
/// </summary>
public sealed class ListActiveFacultiesUseCase(ILookupsReadDbContext db)
{
    public async Task<IReadOnlyList<FacultyPublicDto>> ExecuteAsync(CancellationToken ct = default)
        => await db.Faculties
            .Where(f => f.IsActive)
            .OrderBy(f => f.Name)
            .Select(f => new FacultyPublicDto(f.Code, f.Name))
            .ToListAsync(ct);
}
