namespace PACademy.Contracts.Auth;

public sealed record LoginResponse(
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps);
