using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;
using PACademy.Modules.Committees.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Committees.Application.Committees;

public sealed class CreateCommitteeUseCase(ICommitteesDbContext db, IIdentityApi identity)
{
    public async Task<CommitteeDto> ExecuteAsync(
        CreateCommitteeRequest request, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        var duplicate = await db.Committees.AnyAsync(
            c => c.CycleId == request.CycleId && c.Key == request.Key && c.DeletedAt == null, ct);
        if (duplicate)
            throw new InvalidOperationException("يوجد بالفعل لجنة بهذا المفتاح في هذه الدورة");

        var committee = Committee.Create(
            request.CycleId,
            request.Key,
            request.NameAr,
            request.NameEn,
            request.ChairUserId,
            request.DailyCapacity,
            request.Specializations,
            actor.Id);

        db.Committees.Add(committee);
        await db.SaveChangesAsync(ct);

        return CommitteeMapper.ToDto(committee);
    }
}
