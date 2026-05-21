namespace PACademy.Modules.IdentityApplicant.Application.Auth;

/// <summary>
/// Auth payload the applicant frontend consumes (mirrors the frontend
/// <c>AuthUser</c> type in <c>features/auth/store/auth.store.ts</c>).
/// Role is always <c>"applicant"</c> on this backend.
/// </summary>
public sealed record AuthUserDto(
    Guid Id,
    string Name,
    string Role,
    string RoleLabel,
    IReadOnlyList<string> Apps,
    IReadOnlyList<string> Permissions,
    string Token,
    long LoggedInAt);

public sealed record LoginRequest(string Username, string Password, string Role);
