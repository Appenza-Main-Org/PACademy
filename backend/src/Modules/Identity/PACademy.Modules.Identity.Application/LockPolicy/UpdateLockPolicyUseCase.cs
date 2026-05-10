using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Identity.Application.LockPolicies;

public sealed record UpdateLockPolicyCommand(int? MaxFailedAttempts, int? LockDurationMinutes);

public sealed record ValidationError(string Field, string Constraint, object Value);

public sealed class UpdateLockPolicyUseCase(IIdentityDbContext db, IAuditApi audit)
{
    public async Task<(LockPolicyDto? Updated, IReadOnlyList<ValidationError>? Errors)> ExecuteAsync(
        UpdateLockPolicyCommand command, Guid updatedBy, CancellationToken ct = default)
    {
        var errors = new List<ValidationError>();

        if (command.MaxFailedAttempts.HasValue &&
            (command.MaxFailedAttempts.Value < 1 || command.MaxFailedAttempts.Value > 10))
        {
            errors.Add(new ValidationError("maxFailedAttempts", "must be 1..10", command.MaxFailedAttempts.Value));
        }

        if (command.LockDurationMinutes.HasValue &&
            (command.LockDurationMinutes.Value < 5 || command.LockDurationMinutes.Value > 120))
        {
            errors.Add(new ValidationError("lockDurationMinutes", "must be 5..120", command.LockDurationMinutes.Value));
        }

        if (errors.Count > 0) return (null, errors);

        var policy = await db.LockPolicies.FirstOrDefaultAsync(ct);
        if (policy is null)
        {
            policy = Domain.LockPolicy.Default();
            db.LockPolicies.Add(policy);
        }

        var beforeJson = JsonSerializer.Serialize(new { policy.MaxFailedAttempts, policy.LockDurationMinutes });
        policy.Update(command.MaxFailedAttempts, command.LockDurationMinutes, updatedBy);
        var afterJson = JsonSerializer.Serialize(new { policy.MaxFailedAttempts, policy.LockDurationMinutes });

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditAction.LockPolicyUpdated, "lock_policy", Guid.Empty, "lock_policy",
            AuditOutcome.Success, beforeJson, afterJson, ct);

        return (new LockPolicyDto(policy.MaxFailedAttempts, policy.LockDurationMinutes), null);
    }
}

