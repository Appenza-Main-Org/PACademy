using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.TotalScore;

public sealed class ListTotalScoreConfigsUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<TotalScoreConfigDto>> ExecuteAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var configs = await db.TotalScoreConfigs
            .AsNoTracking()
            .Where(c => c.CycleId == cycleId)
            .ToListAsync(ct);
        return configs.Select(TotalScoreMapper.ToDto).ToList();
    }
}
