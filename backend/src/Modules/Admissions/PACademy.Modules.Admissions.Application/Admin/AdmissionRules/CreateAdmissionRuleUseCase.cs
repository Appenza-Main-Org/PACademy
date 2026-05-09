using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;
using System.Data;

namespace PACademy.Modules.Admissions.Application.Admin.AdmissionRules;

public sealed class CreateAdmissionRuleUseCase(IAdmissionsDbContext db, IIdentityApi identityApi)
{
    public async Task<AdmissionRuleDetailDto> ExecuteAsync(
        CreateAdmissionRuleRequest request,
        CancellationToken ct = default)
    {
        var actor = (await identityApi.GetCurrentUserAsync(ct))!;

        // FR-R01/R02: each save creates a new version per cycle. Compute
        // version under Serializable to prevent concurrent v2 publishes.
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        int nextVersion = 1;
        if (request.CycleId.HasValue)
        {
            var maxVersion = await db.AdmissionRules
                .Where(r => r.CycleId == request.CycleId.Value)
                .Select(r => (int?)r.Version)
                .MaxAsync(ct);
            nextVersion = (maxVersion ?? 0) + 1;
        }

        var rule = AdmissionRule.Create(
            name: request.Name,
            createdBy: actor.Id,
            cycleId: request.CycleId,
            version: nextVersion,
            rulesJson: request.Rules?.GetRawText(),
            description: request.Description,
            effectiveAt: request.EffectiveAt);

        db.AdmissionRules.Add(rule);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return GetAdmissionRuleUseCase.MapToDetail(rule);
    }
}
