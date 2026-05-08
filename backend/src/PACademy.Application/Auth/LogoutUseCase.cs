using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;

namespace PACademy.Application.Auth;

public sealed class LogoutUseCase(IPaDbContext db)
{
    public async Task ExecuteAsync(Guid sessionId, CancellationToken ct = default)
    {
        if (sessionId == Guid.Empty) return;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null || session.RevokedAt.HasValue) return;

        session.Revoke("user_logout");
        await db.SaveChangesAsync(ct);
    }
}
