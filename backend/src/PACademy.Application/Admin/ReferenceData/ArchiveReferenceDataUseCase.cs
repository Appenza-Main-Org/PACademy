using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;

namespace PACademy.Application.Admin.ReferenceData;

public sealed class ArchiveReferenceDataUseCase(IPaDbContext db)
{
    public async Task<bool> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await db.ReferenceDataEntries.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entry is null) return false;

        // FR-L05: refuse archive if FK-referenced. For now we only check the
        // governorate→applicant link (the only existing FK to reference data).
        // Other categories don't yet have FK references in the schema.
        if (entry.Category == "governorate")
        {
            var inUse = await db.Applicants
                .AnyAsync(a => a.Governorate == entry.NameAr || a.Governorate == entry.Key, ct);
            if (inUse)
                throw new DomainConflictException(
                    "Cannot archive — this reference is in use by existing records.",
                    "REFERENCE_IN_USE");
        }

        entry.Archive();
        await db.SaveChangesAsync(ct);
        return true;
    }
}
