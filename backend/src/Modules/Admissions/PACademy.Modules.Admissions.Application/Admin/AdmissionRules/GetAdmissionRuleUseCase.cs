using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.AdmissionRules;

public sealed class GetAdmissionRuleUseCase(IAdmissionsDbContext db)
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

    internal static AdmissionRuleDetailDto MapToDetail(AdmissionRule r)
        => new(
            r.Id, r.Name, r.Description, r.CycleId, r.Version, r.EffectiveAt, r.ChangedById,
            JsonDocument.Parse(string.IsNullOrWhiteSpace(r.RulesJson) ? "{}" : r.RulesJson).RootElement.Clone(),
            r.IsActive, r.CreatedAt, r.UpdatedAt, r.DemoOrigin);
}
