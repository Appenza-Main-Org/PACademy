using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class ListDeclarationVersionsUseCase(IAdmissionsDbContext db)
{
    public async Task<IReadOnlyList<ElectronicDeclarationDto>> ExecuteAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var decls = await db.ElectronicDeclarations
            .AsNoTracking()
            .Where(d => d.CycleId == cycleId && !d.IsArchived)
            .OrderByDescending(d => d.Version)
            .ToListAsync(ct);
        return decls.Select(DeclarationMapper.ToDto).ToList();
    }
}
