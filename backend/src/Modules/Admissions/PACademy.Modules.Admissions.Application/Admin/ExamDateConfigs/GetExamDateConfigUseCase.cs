using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.ExamDateConfigs;

public sealed class GetExamDateConfigUseCase(IAdmissionsDbContext db)
{
    public async Task<ExamDateConfigDto?> ExecuteAsync(Guid cycleId, CancellationToken ct = default)
    {
        var cfg = await db.ExamDateConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CycleId == cycleId, ct);
        return cfg is null ? null : ExamDateConfigMapper.ToDto(cfg);
    }
}
