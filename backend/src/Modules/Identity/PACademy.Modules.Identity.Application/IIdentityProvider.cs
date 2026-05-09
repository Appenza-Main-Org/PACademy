namespace PACademy.Modules.Identity.Application;

public enum AuthenticationOutcome
{
    Success = 0,
    InvalidCredentials = 1,
    ArchivedOrDeactivated = 2,
    Locked = 3,
}

public record AuthenticateResult(
    AuthenticationOutcome Outcome,
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps);

public interface IIdentityProvider
{
    Task<AuthenticateResult> AuthenticateAsync(string nationalId, string password, CancellationToken ct = default);

    Task<bool> RequiresSecondFactorAsync(string nationalId, CancellationToken ct = default);

    Task<SystemUserDto?> GetUserAsync(Guid id, CancellationToken ct = default);

    Task<Guid> CreateUserAsync(CreateUserCommand command, CancellationToken ct = default);

    Task UpdateUserAsync(Guid id, UpdateUserCommand command, CancellationToken ct = default);

    Task DeactivateAsync(Guid id, CancellationToken ct = default);

    Task<(IReadOnlyList<SystemUserDto> Items, int TotalCount)> ListUsersAsync(
        string? role, string? q, bool? isActive,
        int page, int pageSize, string? sortBy, string? sortDir,
        CancellationToken ct = default);
}

public record SystemUserDto(
    Guid Id,
    string NationalId,
    string OfficerCode,
    string FullName,
    string Mobile,
    string Email,
    bool IsActive,
    DateTime IssueDate,
    string CardFactoryNumber,
    string Role,
    string? Unit,
    bool DemoOrigin,
    DateTime CreatedAt,
    DateTime? ArchivedAt = null);

public record CreateUserCommand(
    string NationalId,
    string OfficerCode,
    string FullName,
    string Mobile,
    string Email,
    DateTime IssueDate,
    string CardFactoryNumber,
    string Role,
    string? Unit,
    string Password);

public record UpdateUserCommand(
    string? FullName,
    string? Mobile,
    string? Email,
    string? Unit,
    string? Role,
    bool? IsActive);
