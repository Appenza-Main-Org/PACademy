using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

public sealed class CreateCycleExamUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<CycleExamDto> ExecuteAsync(
        Guid cycleId, CreateCycleExamRequest request, CancellationToken ct = default)
    {
        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var exam = CycleExam.Create(
            cycleId, request.ExamTypeKey,
            request.Order, request.IsRequired,
            actor.Id, request.CategoryId, request.FeeEgp);

        db.CycleExams.Add(exam);
        await db.SaveChangesAsync(ct);
        return CycleExamMapper.ToDto(exam);
    }
}
