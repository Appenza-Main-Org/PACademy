using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.AdmissionRules;

namespace PACademy.Application.Admin.AdmissionRules;

public sealed class ListAdmissionRulesUseCase(IPaDbContext db)
{
    public async Task<List<AdmissionRuleListItemDto>> ExecuteAsync(
        Guid? cycleId = null,
        bool includeArchived = false,
        CancellationToken ct = default)
    {
        var query = db.AdmissionRules.AsNoTracking();
        if (!includeArchived) query = query.Where(r => !r.Archived);
        if (cycleId.HasValue) query = query.Where(r => r.CycleId == cycleId.Value);

        return await query
            .OrderByDescending(r => r.EffectiveAt)
            .ThenByDescending(r => r.Version)
            .Select(r => new AdmissionRuleListItemDto(
                r.Id, r.Name, r.CycleId, r.Version, r.EffectiveAt,
                r.ChangedById, r.IsActive, r.CreatedAt))
            .ToListAsync(ct);
    }
}
