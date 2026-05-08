namespace PACademy.Contracts.Auth;

public sealed record MeResponse(
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps);
