using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.MergeSplit;

public sealed class PreviewMergeSplitRuleUseCase(IAdmissionsDbContext db)
{
    public async Task<MergeSplitPreviewDto?> ExecuteAsync(Guid ruleId, CancellationToken ct = default)
    {
        var rule = await db.CommitteeMergeSplitRules
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == ruleId, ct);
        if (rule is null) return null;

        var sourceIds = JsonSerializer.Deserialize<List<Guid>>(rule.SourceCommitteeIdsJson) ?? [];
        var targetIds = JsonSerializer.Deserialize<List<Guid>>(rule.TargetCommitteeIdsJson) ?? [];

        // For merge: move applicants from source committees → single target committee
        // For split: move applicants from single source → target committees (round-robin for preview)
        var applicantMoves = new List<ApplicantMoveDto>();
        var capacityChanges = new List<CapacityChangeDto>();

        if (rule.Type == MergeSplitType.Merge)
        {
            var targetId = targetIds[0];
            foreach (var srcId in sourceIds)
            {
                var applicants = await db.Applicants
                    .AsNoTracking()
                    .Where(a => a.CommitteeId == srcId && a.CycleId == rule.CycleId)
                    .Select(a => a.Id)
                    .ToListAsync(ct);

                applicantMoves.AddRange(applicants.Select(aid =>
                    new ApplicantMoveDto(aid, srcId, targetId)));
                capacityChanges.Add(new CapacityChangeDto(srcId, applicants.Count, 0));
            }
        }
        else
        {
            var srcId = sourceIds[0];
            var applicants = await db.Applicants
                .AsNoTracking()
                .Where(a => a.CommitteeId == srcId && a.CycleId == rule.CycleId)
                .Select(a => a.Id)
                .ToListAsync(ct);

            for (var i = 0; i < applicants.Count; i++)
                applicantMoves.Add(new ApplicantMoveDto(applicants[i], srcId, targetIds[i % targetIds.Count]));
        }

        var hash = ComputeHash(ruleId, applicantMoves);
        return new MergeSplitPreviewDto(applicantMoves, capacityChanges, [], hash);
    }

    internal static string ComputeHash(Guid ruleId, IReadOnlyList<ApplicantMoveDto> moves)
    {
        var data = $"{ruleId}:{JsonSerializer.Serialize(moves)}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(data));
        return Convert.ToBase64String(bytes);
    }
}
