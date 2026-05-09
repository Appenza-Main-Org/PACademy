using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;

namespace PACademy.Application.Auth;

public sealed class LogoutUseCase(IPaDbContext db)
{
    // FR-A08: revoke ALL active sessions for the user, not just the current one.
    public async Task ExecuteAsync(Guid userId, CancellationToken ct = default)
    {
        if (userId == Guid.Empty) return;

        var sessions = await db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var session in sessions)
            session.Revoke("user_logout");

        await db.SaveChangesAsync(ct);
    }
}
