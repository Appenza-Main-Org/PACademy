using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class UpdateDeclarationUseCase(IAdmissionsDbContext db)
{
    public async Task<ElectronicDeclarationDto?> ExecuteAsync(
        Guid id, UpdateDeclarationRequest request, CancellationToken ct = default)
    {
        var decl = await db.ElectronicDeclarations
            .FirstOrDefaultAsync(d => d.Id == id, ct);
        if (decl is null) return null;

        var mode = request.Mode is null ? (Domain.DeclarationMode?)null
            : DeclarationMapper.ParseMode(request.Mode);

        decl.Update(
            mode,
            request.BodyAr,
            request.Document?.FileName,
            request.Document?.FileUrl,
            request.Document?.Size,
            request.ClearDocument,
            request.EffectiveFrom);
        await db.SaveChangesAsync(ct);
        return DeclarationMapper.ToDto(decl);
    }
}
