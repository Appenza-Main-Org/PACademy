using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Committees;
using PACademy.Modules.Committees.Application.Dtos;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Application.DateBindings;

public sealed class UpsertDateBindingUseCase(ICommitteesDbContext db)
{
    public async Task<CommitteeDateBindingDto?> ExecuteAsync(
        Guid committeeId, DateOnly boundDate,
        UpsertDateBindingRequest request, CancellationToken ct = default)
    {
        var committeeExists = await db.Committees.AnyAsync(c => c.Id == committeeId, ct);
        if (!committeeExists) return null;

        var existing = await db.CommitteeDateBindings
            .FirstOrDefaultAsync(b => b.CommitteeId == committeeId && b.BoundDate == boundDate, ct);

        if (existing is null)
        {
            var created = CommitteeDateBinding.Create(committeeId, boundDate, request.Capacity);
            db.CommitteeDateBindings.Add(created);
            await db.SaveChangesAsync(ct);
            return CommitteeMapper.ToDto(created);
        }

        existing.UpdateCapacity(request.Capacity);
        await db.SaveChangesAsync(ct);
        return CommitteeMapper.ToDto(existing);
    }
}
