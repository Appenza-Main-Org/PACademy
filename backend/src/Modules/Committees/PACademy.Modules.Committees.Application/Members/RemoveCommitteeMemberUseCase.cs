using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Committees.Application.Members;

public sealed class RemoveCommitteeMemberUseCase(ICommitteesDbContext db)
{
    public async Task<bool> ExecuteAsync(
        Guid committeeId, Guid userId, CancellationToken ct = default)
    {
        var c = await db.Committees
            .Include(x => x.Members)
            .FirstOrDefaultAsync(x => x.Id == committeeId, ct);
        if (c is null) return false;
        c.RemoveMember(userId);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
