using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Admin.Common;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Identity.Public;
using ElectronicDeclarationEntity = PACademy.Modules.Admissions.Domain.ElectronicDeclaration;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class CreateDeclarationDraftUseCase(IAdmissionsDbContext db, IIdentityApi identity)
{
    public async Task<ElectronicDeclarationDto> ExecuteAsync(
        Guid cycleId, CreateDeclarationRequest request, CancellationToken ct = default)
    {
        await CycleStatusGuard.EnsureDraftAsync(db, cycleId, ct);
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var latestVersion = await db.ElectronicDeclarations
            .AsNoTracking()
            .Where(d => d.CycleId == cycleId)
            .MaxAsync(d => (int?)d.Version, ct) ?? 0;

        var decl = ElectronicDeclarationEntity.CreateDraft(
            cycleId,
            DeclarationMapper.ParseMode(request.Mode),
            request.BodyAr,
            request.Document?.FileName,
            request.Document?.FileUrl,
            request.Document?.Size,
            request.EffectiveFrom,
            actor.Id,
            latestVersion + 1);
        db.ElectronicDeclarations.Add(decl);
        await db.SaveChangesAsync(ct);
        return DeclarationMapper.ToDto(decl);
    }
}
