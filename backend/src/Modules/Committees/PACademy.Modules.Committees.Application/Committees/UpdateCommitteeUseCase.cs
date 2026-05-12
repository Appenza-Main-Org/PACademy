using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class UpdateCommitteeUseCase(ICommitteesDbContext db)
{
    public async Task<CommitteeDto?> ExecuteAsync(
        Guid id, UpdateCommitteeRequest request, CancellationToken ct = default)
    {
        var c = await db.Committees
            .Include(x => x.Members)
            .Include(x => x.Specializations)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return null;

        Domain.CommitteeStatus? status = null;
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<Domain.CommitteeStatus>(request.Status, true, out var s))
            status = s;

        c.Update(request.NameAr ?? c.NameAr, request.NameEn, request.ChairUserId,
            request.DailyCapacity ?? c.DailyCapacity, status);
        await db.SaveChangesAsync(ct);
        return CommitteeMapper.ToDto(c);
    }
}
