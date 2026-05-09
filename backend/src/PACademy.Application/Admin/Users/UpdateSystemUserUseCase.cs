using Microsoft.EntityFrameworkCore;
using PACademy.Application.Audit;
using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Contracts.Admin.Users;
using PACademy.Domain.Audit;
using System.Data;
using System.Text.Json;

namespace PACademy.Application.Admin.Users;

public sealed class UpdateSystemUserUseCase(
    IIdentityProvider identity,
    IPaDbContext db,
    IAuditWriter audit)
{
    public async Task<SystemUserDetailDto?> ExecuteAsync(
        Guid id,
        UpdateSystemUserRequest request,
        CancellationToken ct = default)
    {
        var existing = await identity.GetUserAsync(id, ct);
        if (existing is null) return null;

        var prevRole = existing.Role;
        var roleChanged = request.Role is not null && request.Role != prevRole;

        // FR-C06: role change must revoke sessions atomically with the role update.
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        if (roleChanged)
        {
            var activeSessions = await db.Sessions
                .Where(s => s.UserId == id && s.RevokedAt == null)
                .ToListAsync(ct);
            foreach (var session in activeSessions)
                session.Revoke("role_changed");
        }

        var command = new UpdateUserCommand(
            request.FullName,
            request.Mobile,
            request.Email,
            request.Unit,
            request.Role,
            request.IsActive);

        await identity.UpdateUserAsync(id, command, ct);

        string? beforeJson = roleChanged
            ? JsonSerializer.Serialize(new { role = prevRole })
            : null;
        string? afterJson = roleChanged
            ? JsonSerializer.Serialize(new { role = request.Role })
            : null;

        await audit.RecordAsync(
            AuditAction.Update, "user", id, existing.FullName,
            AuditOutcome.Success, beforeJson, afterJson, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var updated = await identity.GetUserAsync(id, ct);
        return updated is null ? null : GetSystemUserUseCase.MapToDetailDto(updated);
    }
}
