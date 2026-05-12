using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Infrastructure.Persistence;
using PACademy.Modules.Committees.Public;

namespace PACademy.Modules.Committees.Infrastructure;

internal sealed class CommitteesApiService(CommitteesDbContext db) : ICommitteeApi
{
    public async Task<IReadOnlyList<CommitteeSummaryDto>> GetByCycleAsync(
        Guid cycleId, CancellationToken ct = default)
    {
        var committees = await db.Committees
            .Where(c => c.CycleId == cycleId && c.DeletedAt == null)
            .ToListAsync(ct);

        return committees.Select(c => new CommitteeSummaryDto(
            c.Id, c.Key, c.NameAr, c.NameEn, c.DailyCapacity,
            c.Status.ToString().ToLowerInvariant())).ToList();
    }

    public async Task<bool> ExistsAsync(Guid committeeId, CancellationToken ct = default)
        => await db.Committees.AnyAsync(c => c.Id == committeeId && c.DeletedAt == null, ct);
}
