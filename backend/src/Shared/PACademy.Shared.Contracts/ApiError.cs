namespace PACademy.Shared.Contracts;

/// <summary>
/// Cross-module problem-details shape. Every error response from any module's controllers
/// serialises to this. Inspired by RFC 7807 but tailored to the platform.
/// </summary>
public sealed record ApiError(
    string Code,
    string Message,
    int Status,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? Errors = null,
    string? Detail = null);
