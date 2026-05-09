using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Identity.Application;

public sealed class IdentityApi(ICurrentUser currentUser) : IIdentityApi
{
    public Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default)
    {
        if (!currentUser.IsAuthenticated)
            return Task.FromResult<CurrentUserDto?>(null);

        var dto = new CurrentUserDto(
            currentUser.Id,
            currentUser.Name,
            currentUser.Role,
            currentUser.Apps);
        return Task.FromResult<CurrentUserDto?>(dto);
    }

    public Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default)
    {
        // Delegates to repo in a real implementation; placeholder for Phase 5
        return Task.FromResult(currentUser.IsAuthenticated && currentUser.Id == userId);
    }
}
