using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.IdentityApplicant.Application.Auth;

/// <summary>
/// Returns the current authenticated applicant — used by the frontend's
/// AuthStore rehydration step. Caller resolves <paramref name="applicantId"/>
/// from the validated JWT (<c>sub</c> claim).
/// </summary>
public sealed class GetMeUseCase(IApplicantsDbContext db)
{
    public async Task<AuthUserDto?> ExecuteAsync(Guid applicantId, CancellationToken ct = default)
    {
        var a = await db.Applicants
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == applicantId, ct);
        if (a is null) return null;

        return new AuthUserDto(
            Id: a.Id,
            Name: a.FullName ?? "متقدم",
            Role: "applicant",
            RoleLabel: "متقدم",
            Apps: new[] { "applicant" },
            Permissions: new[] { "applicant:portal" },
            /* /me does NOT mint a new token — the caller already has one
             * (it's what authorised the request). Empty + the original
             * LoggedInAt avoids accidentally extending the session here. */
            Token: string.Empty,
            LoggedInAt: new DateTimeOffset(a.UpdatedAt.UtcDateTime).ToUnixTimeMilliseconds());
    }
}
