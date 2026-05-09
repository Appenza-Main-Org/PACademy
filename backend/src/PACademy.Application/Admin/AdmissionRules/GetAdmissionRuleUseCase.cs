using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.AdmissionRules;
using System.Text.Json;

namespace PACademy.Application.Admin.AdmissionRules;

public sealed class GetAdmissionRuleUseCase(IPaDbContext db)
{
    public async Task<AdmissionRuleDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var r = await db.AdmissionRules.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return r is null ? null : MapToDetail(r);
    }

    public async Task<AdmissionRuleDetailDto?> ExecuteCurrentAsync(Guid cycleId, CancellationToken ct = default)
    {
        var r = await db.AdmissionRules.AsNoTracking()
            .Where(x => x.CycleId == cycleId && !x.Archived)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);
        return r is null ? null : MapToDetail(r);
    }

    internal static AdmissionRuleDetailDto MapToDetail(Domain.AdmissionRules.AdmissionRule r)
        => new(
            r.Id, r.Name, r.Description, r.CycleId, r.Version, r.EffectiveAt, r.ChangedById,
            JsonDocument.Parse(string.IsNullOrWhiteSpace(r.RulesJson) ? "{}" : r.RulesJson).RootElement.Clone(),
            r.IsActive, r.CreatedAt, r.UpdatedAt, r.DemoOrigin);
}
