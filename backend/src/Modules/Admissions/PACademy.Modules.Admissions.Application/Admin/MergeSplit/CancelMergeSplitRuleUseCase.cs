using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class CancelMergeSplitRuleUseCase(
    IAdmissionsDbContext db, IIdentityApi identity, IAuditApi audit)
{
    public async Task<MergeSplitRuleDto?> ExecuteAsync(
        Guid id, CancelMergeSplitRuleRequest request, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rule is null) return null;

        var actor = (await identity.GetCurrentUserAsync(ct))!;
        rule.Cancel(actor.Id, request.Reason);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(AuditAction.Update, "CommitteeMergeSplitRule",
            rule.Id, "merge_rule_cancelled", AuditOutcome.Success);

        return MergeSplitMapper.ToDto(rule);
    }
}
