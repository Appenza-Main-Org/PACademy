using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class CreateCycleUseCase(
    IAdmissionsDbContext db,
    IIdentityApi identityApi)
{
    public async Task<CycleDetailDto> ExecuteAsync(
        CreateCycleRequest request,
        CancellationToken ct = default)
    {
        var actor = (await identityApi.GetCurrentUserAsync(ct))!;

        var cycle = Cycle.Create(
            request.NameAr,
            request.Year,
            request.Cohort,
            request.ExpectedCapacity,
            request.OpenDate,
            request.CloseDate,
            actor.Id);

        db.Cycles.Add(cycle);
        await db.SaveChangesAsync(ct);

        return GetCycleUseCase.MapToDetailDto(cycle, 0);
    }
}
