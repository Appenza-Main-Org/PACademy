using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;
using System.Diagnostics;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class ApplyMergeSplitRuleUseCase(
    IAdmissionsDbContext db,
    IIdentityApi identity,
    IAuditApi audit,
    PreviewMergeSplitRuleUseCase preview)
{
    public async Task<ApplyResultDto> ExecuteAsync(
        Guid ruleId, ApplyMergeSplitRuleRequest request, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .FirstOrDefaultAsync(r => r.Id == ruleId, ct)
            ?? throw new DomainConflictException("القاعدة غير موجودة", "RULE_NOT_FOUND");

        if (rule.Status != MergeSplitStatus.Planned)
            throw new DomainConflictException("يمكن تطبيق القواعد بحالة 'مخططة' فقط", "RULE_NOT_PLANNED");

        // Re-run preview to validate hash
        var previewResult = await preview.ExecuteAsync(ruleId, ct)
            ?? throw new DomainConflictException("فشل في حساب معاينة القاعدة", "PREVIEW_FAILED");

        if (previewResult.PreviewHash != request.ConfirmPreviewHash)
            throw new DomainConflictException(
                "تغيرت بيانات المعاينة — يرجى تحديث المعاينة قبل التطبيق",
                "STALE_PREVIEW_HASH");

        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var sw = Stopwatch.StartNew();

        // Move applicants
        var sourceIds = JsonSerializer.Deserialize<List<Guid>>(rule.SourceCommitteeIdsJson) ?? [];
        var targetIds = JsonSerializer.Deserialize<List<Guid>>(rule.TargetCommitteeIdsJson) ?? [];

        int movedCount = 0;
        if (rule.Type == MergeSplitType.Merge)
        {
            var targetId = targetIds[0];
            foreach (var srcId in sourceIds)
            {
                var applicants = await db.Applicants
                    .Where(a => a.CommitteeId == srcId && a.CycleId == rule.CycleId)
                    .ToListAsync(ct);
                foreach (var a in applicants)
                    a.AssignCommittee(targetId);
                movedCount += applicants.Count;
            }
        }
        else
        {
            var srcId = sourceIds[0];
            var applicants = await db.Applicants
                .Where(a => a.CommitteeId == srcId && a.CycleId == rule.CycleId)
                .ToListAsync(ct);
            for (var i = 0; i < applicants.Count; i++)
                applicants[i].AssignCommittee(targetIds[i % targetIds.Count]);
            movedCount = applicants.Count;
        }

        rule.Apply(actor.Id);
        await db.SaveChangesAsync(ct);
        sw.Stop();

        await audit.RecordAsync(AuditAction.Update, "CommitteeMergeSplitRule",
            rule.Id, "merge_rule_applied", AuditOutcome.Success);

        return new ApplyResultDto(true, movedCount, sw.ElapsedMilliseconds);
    }
}
