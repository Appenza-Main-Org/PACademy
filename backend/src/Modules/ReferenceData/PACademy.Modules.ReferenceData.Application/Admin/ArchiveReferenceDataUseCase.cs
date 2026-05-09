using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.ReferenceData.Application.Admin;

public sealed class ArchiveReferenceDataUseCase(IReferenceDataDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await db.ReferenceDataEntries.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entry is null) return false;

        // FR-L05: refuse archive if FK-referenced.
        // Cross-module FK check (e.g. governorate→applicant) is deferred to Phase 6
        // when the Admissions module exposes a dedicated query for this.

        entry.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
