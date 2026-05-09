using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.AdmissionRules;
using System.Data;

namespace PACademy.Application.Admin.AdmissionRules;

public sealed class CreateAdmissionRuleUseCase(IPaDbContext db, ICurrentUser currentUser)
{
    public async Task<AdmissionRuleDetailDto> ExecuteAsync(
        CreateAdmissionRuleRequest request,
        CancellationToken ct = default)
    {
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

        var rule = Domain.AdmissionRules.AdmissionRule.Create(
            name: request.Name,
            createdBy: currentUser.Id,
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
