using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using PACademy.Modules.Admissions.Public;

namespace PACademy.Modules.Admissions.Infrastructure;

internal sealed class AdmissionsApiService(AdmissionsDbContext db) : IAdmissionsApi
{
    public async Task<CycleSummaryDto?> GetActiveCycleAsync(CancellationToken ct = default)
    {
        var cycle = await db.Cycles
            .Where(c => c.Status == CycleStatus.Active)
            .OrderByDescending(c => c.OpenDate)
            .FirstOrDefaultAsync(ct);
        return cycle is null ? null
            : new CycleSummaryDto(cycle.Id, cycle.NameAr, cycle.Status.ToString(), cycle.OpenDate, cycle.CloseDate);
    }

    public async Task<CategorySummaryDto?> GetCategoryByKeyAsync(string key, CancellationToken ct = default)
    {
        var cat = await db.Categories.FirstOrDefaultAsync(c => c.Key == key, ct);
        return cat is null ? null
            : new CategorySummaryDto(cat.Id, cat.Key, cat.NameAr, cat.NameEn);
    }
}
