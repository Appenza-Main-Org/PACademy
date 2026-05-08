using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Domain.Sessions;

namespace PACademy.Application.Auth;

public sealed record LoginOutcome(
    bool Succeeded,
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps,
    Guid SessionId);

public sealed class LoginUseCase(IIdentityProvider identity, IPaDbContext db)
{
    public async Task<LoginOutcome> ExecuteAsync(
        string nationalId,
        string password,
        string ipAddress,
        string userAgent,
        CancellationToken ct = default)
    {
        var auth = await identity.AuthenticateAsync(nationalId, password, ct);
        if (!auth.Succeeded)
        {
            return new LoginOutcome(
                false, Guid.Empty, string.Empty, string.Empty, string.Empty,
                Array.Empty<string>(), Guid.Empty);
        }

        var session = Session.Create(auth.UserId, ipAddress, userAgent);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);

        return new LoginOutcome(
            true, auth.UserId, auth.NationalId, auth.FullName, auth.Role,
            auth.Apps, session.Id);
    }
}
