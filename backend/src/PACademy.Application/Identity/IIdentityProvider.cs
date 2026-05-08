namespace PACademy.Application.Identity;

public record AuthenticateResult(bool Succeeded, Guid UserId, string NationalId, string FullName, string Role, IReadOnlyList<string> Apps);

public interface IIdentityProvider
{
    Task<AuthenticateResult> AuthenticateAsync(string nationalId, string password, CancellationToken ct = default);

    Task<bool> RequiresSecondFactorAsync(string nationalId, CancellationToken ct = default);

    Task<SystemUserDto?> GetUserAsync(Guid id, CancellationToken ct = default);

    Task<Guid> CreateUserAsync(CreateUserCommand command, CancellationToken ct = default);

    Task DeactivateAsync(Guid id, CancellationToken ct = default);
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
    bool DemoOrigin);

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
