namespace PACademy.Shared.Contracts;

public sealed class ConflictException(string conflictCode, string? message = null, object? payload = null)
    : Exception(message ?? conflictCode)
{
    public string ConflictCode { get; } = conflictCode;
    public object? Payload { get; } = payload;
}

public sealed class DependencyBlockedException(string dependencyCode, string? message = null, object? result = null)
    : Exception(message ?? dependencyCode)
{
    public string DependencyCode { get; } = dependencyCode;
    public object? Result { get; } = result;
}

public sealed class EntityNotFoundException(string message) : Exception(message);
