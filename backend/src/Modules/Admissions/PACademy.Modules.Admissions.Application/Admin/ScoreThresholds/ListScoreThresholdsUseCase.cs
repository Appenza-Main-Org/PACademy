using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;

public sealed class ListScoreThresholdsUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<CommitteeScoreThresholdDto>> ExecuteAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var thresholds = await db.CommitteeScoreThresholds
            .AsNoTracking()
            .Where(t => t.CycleId == cycleId)
            .ToListAsync(ct);
        return thresholds.Select(ScoreThresholdMapper.ToDto).ToList();
    }
}
