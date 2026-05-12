using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.TotalScore;

public sealed class GetTotalScoreConfigUseCase(IAdmissionsDbContext db)
{
    public async Task<TotalScoreConfigDto?> ExecuteAsync(
        Guid cycleId, string stream, CancellationToken ct = default)
    {
        if (!Enum.TryParse<ApplicantStream>(stream, true, out var s)) return null;
        var cfg = await db.TotalScoreConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CycleId == cycleId && c.ApplicantStream == s, ct);
        return cfg is null ? null : TotalScoreMapper.ToDto(cfg);
    }
}
