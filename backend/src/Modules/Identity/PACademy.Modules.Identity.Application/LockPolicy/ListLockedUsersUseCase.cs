using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Identity.Application.LockPolicies;

public sealed record LockedUserDto(
    Guid UserId,
    string Name,
    string Role,
    string Reason,
    DateTime LockedAt,
    DateTime UnlocksAt);

public sealed class ListLockedUsersUseCase(IIdentityDbContext db)
{
    public async Task<(IReadOnlyList<LockedUserDto> Items, int Total)> ExecuteAsync(CancellationToken ct = default)
    {
        var items = await db.LockoutStates
            .OrderBy(l => l.UnlocksAt)
            .Join(db.SystemUsers,
                l => l.UserId,
                u => u.Id,
                (l, u) => new LockedUserDto(
                    l.UserId, u.FullName, u.Role,
                    l.Reason, l.LockedAt, l.UnlocksAt))
            .ToListAsync(ct);

        return (items, items.Count);
    }
}

