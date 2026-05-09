namespace PACademy.Modules.Identity.Application.Auth;

public sealed record MeResult(
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps);

public sealed class GetMeUseCase(IIdentityProvider identity)
{
    public async Task<MeResult?> ExecuteAsync(Guid userId, CancellationToken ct = default)
    {
        if (userId == Guid.Empty) return null;

        var user = await identity.GetUserAsync(userId, ct);
        if (user is null || !user.IsActive) return null;

        return new MeResult(
            user.Id,
            user.NationalId,
            user.FullName,
            user.Role,
            RoleApps.ForRole(user.Role));
    }
}
