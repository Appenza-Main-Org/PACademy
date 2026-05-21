using PACademy.Shared.Domain.Identity;

namespace PACademy.Modules.IdentityApplicant.Application.Auth;

/// <summary>
/// Issues JWTs scoped to the applicant audience (<c>aud='applicant-api'</c>).
/// Tokens carry the applicant id + national id as claims; the bearer
/// middleware on <c>PACademy.Applicant.Api</c> validates the audience so
/// admin-issued tokens are rejected.
/// </summary>
public interface IJwtTokenService
{
    /// <summary>Mint a token + return the unix-epoch issued-at timestamp (ms).</summary>
    (string Token, long IssuedAtMs) Issue(Applicant applicant);
}
