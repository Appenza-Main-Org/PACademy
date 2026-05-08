using PACademy.Application.Audit;
using PACademy.Application.Common;
using PACademy.Domain.Audit;

namespace PACademy.Api.Tests.Fixtures;

internal sealed class NullCurrentUser : ICurrentUser
{
    public static readonly NullCurrentUser Instance = new();
    public Guid Id => Guid.Empty;
    public string Name => "test";
    public string IpAddress => "::1";
    public bool IsAuthenticated => false;
}

internal sealed class NullAuditWriter : IAuditWriter
{
    public static readonly NullAuditWriter Instance = new();

    public Task RecordAsync(
        AuditAction action, string targetType, Guid targetId, string targetLabel,
        AuditOutcome outcome, string? beforeJson = null, string? afterJson = null,
        CancellationToken ct = default) => Task.CompletedTask;

    public Task RecordBulkAsync(
        AuditEntry summary, IReadOnlyList<AuditEntry> children,
        CancellationToken ct = default) => Task.CompletedTask;
}
