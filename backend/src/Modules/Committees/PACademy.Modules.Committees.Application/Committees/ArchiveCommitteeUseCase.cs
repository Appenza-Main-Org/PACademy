using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class ArchiveCommitteeUseCase(ICommitteesDbContext db, IIdentityApi identity)
{
    public async Task<bool> ExecuteAsync(Guid id, string? reason, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var c = await db.Committees.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return false;
        c.Archive(actor.Id, reason);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
