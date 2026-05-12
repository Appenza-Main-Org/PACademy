using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class GetPublishedDeclarationUseCase(IAdmissionsDbContext db)
{
    public async Task<ElectronicDeclarationDto?> ExecuteAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var decl = await db.ElectronicDeclarations
            .AsNoTracking()
            .Where(d => d.CycleId == cycleId && d.PublishedAt.HasValue && !d.IsArchived)
            .OrderByDescending(d => d.PublishedAt)
            .FirstOrDefaultAsync(ct);
        return decl is null ? null : DeclarationMapper.ToDto(decl);
    }
}
