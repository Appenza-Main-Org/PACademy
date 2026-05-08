using PACademy.Application.Identity;
using PACademy.Contracts.Auth;

namespace PACademy.Application.Auth;

public sealed class GetMeUseCase(IIdentityProvider identity)
{
    public async Task<MeResponse?> ExecuteAsync(Guid userId, CancellationToken ct = default)
    {
        if (userId == Guid.Empty) return null;

        var user = await identity.GetUserAsync(userId, ct);
        if (user is null || !user.IsActive) return null;

        return new MeResponse(
            user.Id,
            user.NationalId,
            user.FullName,
            user.Role,
            RoleApps.ForRole(user.Role));
    }
}
