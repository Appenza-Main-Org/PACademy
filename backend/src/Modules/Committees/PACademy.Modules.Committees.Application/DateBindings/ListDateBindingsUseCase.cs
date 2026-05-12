using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Committees;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Modules.Committees.Application.DateBindings;

public sealed class ListDateBindingsUseCase(ICommitteesDbContext db)
{
    public async Task<IReadOnlyList<CommitteeDateBindingDto>> ExecuteAsync(
        Guid committeeId, CancellationToken ct = default)
    {
        var bindings = await db.CommitteeDateBindings
            .Where(b => b.CommitteeId == committeeId)
            .OrderBy(b => b.BoundDate)
            .ToListAsync(ct);
        return bindings.Select(CommitteeMapper.ToDto).ToList();
    }
}
