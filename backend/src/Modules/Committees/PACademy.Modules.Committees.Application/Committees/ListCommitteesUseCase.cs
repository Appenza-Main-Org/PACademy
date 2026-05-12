using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class ListCommitteesUseCase(ICommitteesDbContext db)
{
    public async Task<IReadOnlyList<CommitteeDto>> ExecuteAsync(
        Guid cycleId, string? status, bool includeArchived, CancellationToken ct = default)
    {
        var query = db.Committees
            .Include(c => c.Members)
            .Include(c => c.Specializations)
            .Where(c => c.CycleId == cycleId);

        if (!includeArchived)
            query = query.Where(c => c.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<Domain.CommitteeStatus>(status, true, out var s))
            query = query.Where(c => c.Status == s);

        var list = await query.ToListAsync(ct);
        return list.Select(CommitteeMapper.ToDto).ToList();
    }
}
