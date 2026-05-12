using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.TotalScore;

public sealed class UpsertTotalScoreConfigUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<TotalScoreConfigDto> ExecuteAsync(
        Guid cycleId, string stream,
        UpsertTotalScoreConfigRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<ApplicantStream>(stream, true, out var applicantStream))
            throw new ArgumentException($"الفئة '{stream}' غير صالحة");

        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var components = request.Components
            .Select(c => new TotalScoreComponent(c.ExamKey, c.Weight, c.MinimumPassingScore))
            .ToList();

        var existing = await db.TotalScoreConfigs
            .FirstOrDefaultAsync(c => c.CycleId == cycleId && c.ApplicantStream == applicantStream, ct);

        if (existing is null)
        {
            var created = TotalScoreConfig.Create(cycleId, applicantStream, components, request.TotalScoreOutOf, actor.Id);
            db.TotalScoreConfigs.Add(created);
            await db.SaveChangesAsync(ct);
            return TotalScoreMapper.ToDto(created);
        }

        existing.Update(components, request.TotalScoreOutOf, actor.Id);
        await db.SaveChangesAsync(ct);
        return TotalScoreMapper.ToDto(existing);
    }
}
