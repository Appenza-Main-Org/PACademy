using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.ExamDateConfigs;

public sealed class UpsertExamDateConfigUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<ExamDateConfigDto> ExecuteAsync(
        Guid cycleId, UpsertExamDateConfigRequest request, CancellationToken ct = default)
    {
        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var existing = await db.ExamDateConfigs
            .FirstOrDefaultAsync(c => c.CycleId == cycleId, ct);

        if (existing is null)
        {
            var created = ExamDateConfig.Create(
                cycleId, request.FirstAvailableDate,
                request.BookableDays, request.BlackoutDates, actor.Id);
            db.ExamDateConfigs.Add(created);
            await db.SaveChangesAsync(ct);
            return ExamDateConfigMapper.ToDto(created);
        }

        existing.Update(request.FirstAvailableDate, request.BookableDays, request.BlackoutDates, actor.Id);
        await db.SaveChangesAsync(ct);
        return ExamDateConfigMapper.ToDto(existing);
    }
}
