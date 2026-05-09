namespace PACademy.Modules.Identity.Public;

public interface IIdentityApi
{
    Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default);
    Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default);
}

public sealed record CurrentUserDto(Guid Id, string FullName, string Role, IReadOnlyList<string> Apps);
