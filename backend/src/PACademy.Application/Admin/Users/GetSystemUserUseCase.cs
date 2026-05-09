using PACademy.Application.Identity;
using PACademy.Contracts.Admin.Users;

namespace PACademy.Application.Admin.Users;

public sealed class GetSystemUserUseCase(IIdentityProvider identity)
{
    public async Task<SystemUserDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await identity.GetUserAsync(id, ct);
        return user is null ? null : MapToDetailDto(user);
    }

    internal static SystemUserDetailDto MapToDetailDto(SystemUserDto u) => new(
        u.Id, u.NationalId, u.FullName, u.Role,
        u.Mobile, u.Email, u.Unit, u.IsActive, u.CreatedAt,
        u.DemoOrigin, u.OfficerCode, u.IssueDate, u.CardFactoryNumber, u.ArchivedAt);
}
