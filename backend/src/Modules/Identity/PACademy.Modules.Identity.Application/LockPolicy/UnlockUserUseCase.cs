using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Application.Auth;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Identity.Application.LockPolicies;

public sealed class UnlockUserUseCase(IIdentityDbContext db, IPendingOtpStore otpStore, IAuditApi audit)
{
    public async Task<string?> ExecuteAsync(Guid userId, Guid unlockedBy, CancellationToken ct = default)
    {
        var user = await db.SystemUsers.FindAsync([userId], ct);
        if (user is null) return ErrorCodes.NotFound;

        var lockout = await db.LockoutStates.FindAsync([userId], ct);
        if (lockout is null) return ErrorCodes.NotFound;

        var beforeJson = JsonSerializer.Serialize(new
        {
            lockout.UserId,
            lockout.Reason,
            lockout.LockedAt,
            lockout.UnlocksAt,
            lockout.FailedAttemptCount
        });

        db.LockoutStates.Remove(lockout);
        await otpStore.InvalidateAllForUserAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditAction.ManualUnlock, "user", userId, user.FullName,
            AuditOutcome.Success, beforeJson, null, ct);

        return null; // success
    }
}

