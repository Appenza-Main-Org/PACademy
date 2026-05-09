using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Domain;
using PACademy.Modules.Identity.Infrastructure.Persistence;

namespace PACademy.Modules.Identity.Infrastructure;

internal sealed class InSystemIdentityProvider(
    UserManager<SystemUser> userManager,
    SignInManager<SystemUser> signInManager,
    IdentityDbContext db)
    : IIdentityProvider
{
    private const int MaxPageSize = 200;

    public async Task<AuthenticateResult> AuthenticateAsync(
        string nationalId, string password, CancellationToken ct = default)
    {
        // UserName is mirrored from NationalId (plan research §12)
        var user = await userManager.FindByNameAsync(nationalId);
        if (user is null)
            return Fail(AuthenticationOutcome.InvalidCredentials);

        if (!user.IsActive || user.Archived)
            return Fail(AuthenticationOutcome.ArchivedOrDeactivated);

        var result = await signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            var outcome = result.IsLockedOut
                ? AuthenticationOutcome.Locked
                : AuthenticationOutcome.InvalidCredentials;
            return Fail(outcome);
        }

        var apps = RoleApps.ForRole(user.Role);
        return new AuthenticateResult(AuthenticationOutcome.Success, user.Id, user.NationalId, user.FullName, user.Role, apps);
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

        IdentityResult result;
        try
        {
            result = await userManager.CreateAsync(user, command.Password);
        }
        catch (DbUpdateException ex) when (IsUniqueIndexViolation(ex, "IX_system_users_mobile_active"))
        {
            throw new DomainConflictException("رقم الهاتف مستخدم مسبقاً.", "MOBILE_TAKEN");
        }

        if (!result.Succeeded)
        {
            // Surface domain conflict errors before generic fallback
            if (result.Errors.Any(e => e.Code is "DuplicateUserName"))
                throw new DomainConflictException("الرقم القومي مستخدم مسبقاً.", "NATIONAL_ID_TAKEN");
            if (result.Errors.Any(e => e.Code is "DuplicateEmail"))
                throw new DomainConflictException("البريد الإلكتروني مستخدم مسبقاً.", "EMAIL_TAKEN");
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        return user.Id;
    }

    private static bool IsUniqueIndexViolation(DbUpdateException ex, string indexName) =>
        ex.InnerException is SqlException sql
        && (sql.Number == 2601 || sql.Number == 2627)
        && sql.Message.Contains(indexName, StringComparison.Ordinal);

    public async Task UpdateUserAsync(Guid id, UpdateUserCommand command, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(id.ToString())
            ?? throw new KeyNotFoundException($"User {id} not found");

        if (command.FullName is not null) user.FullName = command.FullName;
        if (command.Mobile is not null) user.Mobile = command.Mobile;
        if (command.Email is not null) user.Email = command.Email;
        if (command.Unit is not null) user.Unit = command.Unit;
        if (command.Role is not null) user.Role = command.Role;
        if (command.IsActive is not null) user.IsActive = command.IsActive.Value;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    public async Task DeactivateAsync(Guid id, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(id.ToString())
            ?? throw new KeyNotFoundException($"User {id} not found");

        user.IsActive = false;
        await userManager.UpdateAsync(user);

        var sessions = await db.Sessions
            .Where(s => s.UserId == id && s.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var session in sessions)
            session.Revoke("account_deactivated");

        await db.SaveChangesAsync(ct);
    }

    public async Task<(IReadOnlyList<SystemUserDto> Items, int TotalCount)> ListUsersAsync(
        string? role, string? q, bool? isActive,
        int page, int pageSize, string? sortBy, string? sortDir,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.Role == role);

        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var qTrimmed = q.Trim();
            query = query.Where(u =>
                u.FullName.Contains(qTrimmed) ||
                (u.UserName != null && u.UserName.Contains(qTrimmed)));
        }

        var total = await query.CountAsync(ct);

        query = (sortBy?.ToLowerInvariant(), sortDir?.ToLowerInvariant()) switch
        {
            ("fullname", "asc") => query.OrderBy(u => u.FullName),
            ("fullname", _) => query.OrderByDescending(u => u.FullName),
            ("role", "desc") => query.OrderByDescending(u => u.Role),
            ("role", _) => query.OrderBy(u => u.Role),
            ("createdat", "asc") => query.OrderBy(u => u.CreatedAt),
            _ => query.OrderByDescending(u => u.CreatedAt),
        };

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (users.Select(MapToDto).ToList(), total);
    }

    private static AuthenticateResult Fail(AuthenticationOutcome outcome) =>
        new(outcome, Guid.Empty, string.Empty, string.Empty, string.Empty, []);

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
        user.DemoOrigin,
        user.CreatedAt,
        user.ArchivedAt);
}
