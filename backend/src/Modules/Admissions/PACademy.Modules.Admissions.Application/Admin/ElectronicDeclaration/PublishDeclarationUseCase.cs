using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

public sealed class PublishDeclarationUseCase(IAdmissionsDbContext db, IAuditApi audit)
{
    public async Task<ElectronicDeclarationDto?> ExecuteAsync(
        Guid id, CancellationToken ct = default)
    {
        var decl = await db.ElectronicDeclarations
            .FirstOrDefaultAsync(d => d.Id == id, ct);
        if (decl is null) return null;

        // Unpublish any existing published version for this cycle
        var published = await db.ElectronicDeclarations
            .Where(d => d.CycleId == decl.CycleId && d.PublishedAt.HasValue && d.Id != id)
            .ToListAsync(ct);
        foreach (var p in published)
            p.Unpublish();

        decl.Publish();
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(AuditAction.Update, "ElectronicDeclaration",
            decl.Id, "notification_published", AuditOutcome.Success);

        return DeclarationMapper.ToDto(decl);
    }
}
