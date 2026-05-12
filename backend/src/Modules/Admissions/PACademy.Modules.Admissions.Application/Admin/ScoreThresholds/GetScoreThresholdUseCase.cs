using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;

public sealed class GetScoreThresholdUseCase(IAdmissionsDbContext db)
{
    public async Task<CommitteeScoreThresholdDto?> ExecuteAsync(
        Guid cycleId, Guid committeeId, CancellationToken ct = default)
    {
        var t = await db.CommitteeScoreThresholds
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.CycleId == cycleId && t.CommitteeId == committeeId, ct);
        return t is null ? null : ScoreThresholdMapper.ToDto(t);
    }
}
