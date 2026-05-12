using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class GetCommitteeUseCase(ICommitteesDbContext db)
{
    public async Task<CommitteeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var c = await db.Committees
            .Include(x => x.Members)
            .Include(x => x.Specializations)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? null : CommitteeMapper.ToDto(c);
    }
}
