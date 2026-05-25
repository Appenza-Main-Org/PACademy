namespace PACademy.Shared.Contracts;

public sealed record ApiErrorEnvelope(
    string Code,
    string? ConflictCode = null,
    IReadOnlyDictionary<string, string[]>? Errors = null,
    string? Message = null,
    string? Detail = null,
    object? Result = null,
    object? Payload = null);
