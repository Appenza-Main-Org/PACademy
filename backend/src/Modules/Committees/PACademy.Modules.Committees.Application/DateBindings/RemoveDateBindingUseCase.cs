using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Committees.Application.DateBindings;

public sealed class RemoveDateBindingUseCase(ICommitteesDbContext db)
{
    public async Task<bool> ExecuteAsync(
        Guid committeeId, DateOnly boundDate, CancellationToken ct = default)
    {
        var binding = await db.CommitteeDateBindings
            .FirstOrDefaultAsync(b => b.CommitteeId == committeeId && b.BoundDate == boundDate, ct);
        if (binding is null) return false;
        db.CommitteeDateBindings.Remove(binding);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
