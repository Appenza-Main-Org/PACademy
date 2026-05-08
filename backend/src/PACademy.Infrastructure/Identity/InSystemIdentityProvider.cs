using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PACademy.Application.Identity;
using PACademy.Infrastructure.Persistence;

namespace PACademy.Infrastructure.Identity;

internal sealed class InSystemIdentityProvider(
    UserManager<SystemUser> userManager,
    SignInManager<SystemUser> signInManager,
    PaDbContext db)
    : IIdentityProvider
{
    private static readonly string[] SuperAdminRoles = ["super_admin"];

    public async Task<AuthenticateResult> AuthenticateAsync(
        string nationalId, string password, CancellationToken ct = default)
    {
        // UserName is mirrored from NationalId (plan research §12)
        var user = await userManager.FindByNameAsync(nationalId);
        if (user is null || !user.IsActive || user.Archived)
            return new AuthenticateResult(false, Guid.Empty, string.Empty, string.Empty, string.Empty, []);

        var result = await signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return new AuthenticateResult(false, Guid.Empty, string.Empty, string.Empty, string.Empty, []);

        var apps = RoleApps.ForRole(user.Role);
        return new AuthenticateResult(true, user.Id, user.NationalId, user.FullName, user.Role, apps);
    }

    public Task<bool> RequiresSecondFactorAsync(string nationalId, CancellationToken ct = default)
    {
        // FR-031 seam — always false until external Ministry 2FA API is integrated
        return Task.FromResult(false);
    }

    public async Task<SystemUserDto?> GetUserAsync(Guid id, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        return user is null ? null : MapToDto(user);
    }

    public async Task<Guid> CreateUserAsync(CreateUserCommand command, CancellationToken ct = default)
    {
        var user = new SystemUser
        {
            Id = Guid.NewGuid(),
            NationalId = command.NationalId,
            OfficerCode = command.OfficerCode,
            FullName = command.FullName,
            Mobile = command.Mobile,
            Email = command.Email,
            IssueDate = command.IssueDate,
            CardFactoryNumber = command.CardFactoryNumber,
            Role = command.Role,
            Unit = command.Unit,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        var result = await userManager.CreateAsync(user, command.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));

        return user.Id;
    }

    public async Task DeactivateAsync(Guid id, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(id.ToString())
            ?? throw new KeyNotFoundException($"User {id} not found");

        user.IsActive = false;
        await userManager.UpdateAsync(user);

        // Revoke all active sessions
        var sessions = await db.Sessions
            .Where(s => s.UserId == id && s.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var session in sessions)
            session.Revoke("account_deactivated");

        await db.SaveChangesAsync(ct);
    }

    private static SystemUserDto MapToDto(SystemUser user) => new(
        user.Id,
        user.NationalId,
        user.OfficerCode,
        user.FullName,
        user.Mobile,
        user.Email ?? string.Empty,
        user.IsActive,
        user.IssueDate,
        user.CardFactoryNumber,
        user.Role,
        user.Unit,
        user.DemoOrigin);

}
