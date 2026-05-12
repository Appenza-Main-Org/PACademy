using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class RestoreCommitteeUseCase(ICommitteesDbContext db)
{
    public async Task<CommitteeDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var c = await db.Committees
            .Include(x => x.Members)
            .Include(x => x.Specializations)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return null;
        c.Restore();
        await db.SaveChangesAsync(ct);
        return CommitteeMapper.ToDto(c);
    }
}
