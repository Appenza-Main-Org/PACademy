using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class ArchiveDeclarationUseCase(IAdmissionsDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var decl = await db.ElectronicDeclarations
            .FirstOrDefaultAsync(d => d.Id == id, ct);
        if (decl is null) return false;
        decl.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
