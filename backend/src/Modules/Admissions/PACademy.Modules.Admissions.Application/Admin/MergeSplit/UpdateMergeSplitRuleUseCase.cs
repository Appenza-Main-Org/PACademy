using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class UpdateMergeSplitRuleUseCase(IAdmissionsDbContext db)
{
    public async Task<MergeSplitRuleDto?> ExecuteAsync(
        Guid id, UpdateMergeSplitRuleRequest request, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rule is null) return null;

        await CycleStatusGuard.EnsureDraftAsync(db, rule.CycleId, ct);
        rule.UpdateShape(request.SourceCommitteeIds, request.TargetCommitteeIds,
            request.EffectiveAt, request.Reason);
        await db.SaveChangesAsync(ct);
        return MergeSplitMapper.ToDto(rule);
    }
}
