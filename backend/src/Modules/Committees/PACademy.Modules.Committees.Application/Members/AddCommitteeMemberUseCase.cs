using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application.Dtos;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Application.Members;

public sealed class AddCommitteeMemberUseCase(ICommitteesDbContext db)
{
    public async Task<CommitteeMemberDto?> ExecuteAsync(
        Guid committeeId, AddCommitteeMemberRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<CommitteeMemberRole>(request.Role, true, out var role))
            throw new ArgumentException($"دور غير صالح: {request.Role}");

        var c = await db.Committees
            .Include(x => x.Members)
            .FirstOrDefaultAsync(x => x.Id == committeeId, ct);
        if (c is null) return null;

        var member = c.AddMember(request.UserId, role);
        await db.SaveChangesAsync(ct);
        return new CommitteeMemberDto(member.UserId, member.Role.ToString().ToLowerInvariant(), member.AddedAt);
    }
}
