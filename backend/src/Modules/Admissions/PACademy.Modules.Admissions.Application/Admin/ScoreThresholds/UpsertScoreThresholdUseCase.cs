using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;

public sealed class UpsertScoreThresholdUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<CommitteeScoreThresholdDto> ExecuteAsync(
        Guid cycleId, Guid committeeId,
        UpsertScoreThresholdRequest request, CancellationToken ct = default)
    {
        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var existing = await db.CommitteeScoreThresholds
            .FirstOrDefaultAsync(t => t.CycleId == cycleId && t.CommitteeId == committeeId, ct);

        if (existing is null)
        {
            var created = CommitteeScoreThreshold.Create(
                cycleId, committeeId, request.Min, request.Max, actor.Id);
            db.CommitteeScoreThresholds.Add(created);
            await db.SaveChangesAsync(ct);
            return ScoreThresholdMapper.ToDto(created);
        }

        existing.Update(request.Min, request.Max, actor.Id);
        await db.SaveChangesAsync(ct);
        return ScoreThresholdMapper.ToDto(existing);
    }
}
