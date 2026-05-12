using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class CreateMergeSplitRuleUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<MergeSplitRuleDto> ExecuteAsync(
        Guid cycleId, CreateMergeSplitRuleRequest request, CancellationToken ct = default)
    {
        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        if (!Enum.TryParse<MergeSplitType>(request.Type, true, out var type))
            throw new ArgumentException($"نوع القاعدة '{request.Type}' غير صالح");

        var rule = CommitteeMergeSplitRule.Create(
            cycleId, type,
            request.SourceCommitteeIds,
            request.TargetCommitteeIds,
            request.EffectiveAt,
            actor.Id,
            request.Reason);

        db.CommitteeMergeSplitRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return MergeSplitMapper.ToDto(rule);
    }
}
