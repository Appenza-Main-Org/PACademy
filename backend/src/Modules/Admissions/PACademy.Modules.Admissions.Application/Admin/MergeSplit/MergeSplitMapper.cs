using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

internal static class MergeSplitMapper
{
    public static MergeSplitRuleDto ToDto(CommitteeMergeSplitRule r)
    {
        var srcIds = System.Text.Json.JsonSerializer
            .Deserialize<List<Guid>>(r.SourceCommitteeIdsJson) ?? [];
        var tgtIds = System.Text.Json.JsonSerializer
            .Deserialize<List<Guid>>(r.TargetCommitteeIdsJson) ?? [];

        return new MergeSplitRuleDto(
            r.Id, r.CycleId,
            r.Type.ToString(), srcIds, tgtIds,
            r.Reason, r.EffectiveAt,
            r.Status.ToString(),
            r.AppliedAt, r.AppliedBy,
            r.CancelledAt, r.CancelledBy, r.CancelReason,
            r.CreatedAt, r.CreatedBy,
            Convert.ToBase64String(r.RowVersion));
    }
}
