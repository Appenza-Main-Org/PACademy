using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Application.Officers;
using PACademy.Modules.Identity.Infrastructure.Persistence;

namespace PACademy.Modules.Identity.Infrastructure.Officers;

public sealed class StubOfficerLookup(IdentityDbContext db) : IOfficerLookup
{
    public async Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct = default)
    {
        var user = await db.SystemUsers
            .Where(u => u.UserName == nationalId && u.OfficerCode == officerCode && !u.Archived)
            .FirstOrDefaultAsync(ct);

        if (user is null) return null;

        return new OfficerRecord(
            user.NationalId,
            user.OfficerCode,
            user.FullName,
            user.Mobile,
            user.Email ?? string.Empty,
            user.IssueDate,
            user.CardFactoryNumber,
            user.Unit ?? string.Empty);
    }
}
