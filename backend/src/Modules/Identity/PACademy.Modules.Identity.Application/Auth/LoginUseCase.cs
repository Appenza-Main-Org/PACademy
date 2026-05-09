using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Domain;
using System.Data;

namespace PACademy.Modules.Identity.Application.Auth;

public sealed record LoginOutcome(
    AuthenticationOutcome Outcome,
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps,
    Guid SessionId);

public sealed class LoginUseCase(IIdentityProvider identity, IIdentityDbContext db)
{
    public async Task<LoginOutcome> ExecuteAsync(
        string nationalId,
        string password,
        string ipAddress,
        string userAgent,
        CancellationToken ct = default)
    {
        var auth = await identity.AuthenticateAsync(nationalId, password, ct);
        if (auth.Outcome != AuthenticationOutcome.Success)
        {
            return new LoginOutcome(
                auth.Outcome, Guid.Empty, string.Empty, string.Empty,
                string.Empty, Array.Empty<string>(), Guid.Empty);
        }

        // FR-A07: single-session invariant — serializable prevents concurrent logins
        // racing to create two active sessions for the same user.
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        var activeSessions = await db.Sessions
            .Where(s => s.UserId == auth.UserId && s.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var prior in activeSessions)
            prior.Revoke("superseded_by_new_login");

        var session = Session.Create(auth.UserId, ipAddress, userAgent);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new LoginOutcome(
            AuthenticationOutcome.Success,
            auth.UserId, auth.NationalId, auth.FullName, auth.Role,
            auth.Apps, session.Id);
    }
}
