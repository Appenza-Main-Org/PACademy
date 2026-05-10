using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Domain;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;
using System.Data;

namespace PACademy.Modules.Identity.Application.Auth;

public sealed record VerifyOtpAuthUser(
    Guid UserId,
    string NationalId,
    string FullName,
    string Role,
    string RoleLabel,
    string? Unit,
    IReadOnlyList<string> Apps,
    IReadOnlyList<string> Permissions,
    Guid SessionId);

public sealed record VerifyOtpLockedResult(DateTime UnlocksAt, string Reason);

public sealed class VerifyOtpUseCase(
    UserManager<SystemUser> userManager,
    IIdentityDbContext db,
    IPendingOtpStore otpStore,
    OtpCodeHasher hasher,
    IAuditApi audit)
{
    private static readonly Guid AnonymousActorId = Guid.Empty;

    public async Task<(VerifyOtpAuthUser? Ok, string? ErrorCode, int? RemainingAttempts, VerifyOtpLockedResult? Locked)>
        ExecuteAsync(Guid pendingId, string code, string ipAddress, string userAgent, CancellationToken ct = default)
    {
        var pending = await otpStore.GetAsync(pendingId, ct);
        if (pending is null)
        {
            return (null, ErrorCodes.OtpReused, null, null);
        }

        if (pending.IsConsumed)
        {
            await audit.RecordAsync(AuditAction.VerifyOtpFailed, "user", AnonymousActorId,
                pendingId.ToString(), AuditOutcome.Failure, ct: ct);
            return (null, ErrorCodes.OtpReused, null, null);
        }

        if (pending.IsExpired(DateTime.UtcNow))
        {
            await audit.RecordAsync(AuditAction.VerifyOtpFailed, "user", AnonymousActorId,
                pendingId.ToString(), AuditOutcome.Failure, ct: ct);
            return (null, ErrorCodes.OtpExpired, null, null);
        }

        if (!hasher.Verify(code, pending.CodeHash))
        {
            await otpStore.IncrementAttemptAsync(pendingId, ct);

            // Reload to get updated count
            var updated = await otpStore.GetAsync(pendingId, ct);
            var attemptCount = updated?.AttemptCount ?? pending.AttemptCount + 1;

            // Get lock policy
            var policy = await db.LockPolicies.FirstOrDefaultAsync(ct)
                         ?? LockPolicy.Default();

            await audit.RecordAsync(AuditAction.VerifyOtpFailed, "user", pending.UserId,
                pendingId.ToString(), AuditOutcome.Failure, ct: ct);

            if (attemptCount >= policy.MaxFailedAttempts)
            {
                // Create lockout state
                var lockout = LockoutState.Create(
                    pending.UserId, policy.LockDurationMinutes, "otp_failures", attemptCount);
                db.LockoutStates.Add(lockout);
                await db.SaveChangesAsync(ct);

                await audit.RecordAsync(AuditAction.AccountLocked, "user", pending.UserId,
                    pending.UserId.ToString(), AuditOutcome.Success, ct: ct);

                return (null, ErrorCodes.AccountLocked, null,
                    new VerifyOtpLockedResult(lockout.UnlocksAt, lockout.Reason));
            }

            var remaining = policy.MaxFailedAttempts - attemptCount;
            return (null, ErrorCodes.OtpMismatch, remaining, null);
        }

        // Success — consume OTP atomically with session creation
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        pending.MarkConsumed();
        await db.SaveChangesAsync(ct);

        var user = await userManager.FindByIdAsync(pending.UserId.ToString());
        if (user is null)
        {
            await tx.RollbackAsync(ct);
            return (null, ErrorCodes.InvalidCredentials, null, null);
        }

        // Clear any prior active sessions (single-session invariant)
        var activeSessions = await db.Sessions
            .Where(s => s.UserId == user.Id && s.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var s in activeSessions) s.Revoke("superseded_by_new_login");

        var session = Session.Create(user.Id, ipAddress, userAgent);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await audit.RecordAsync(AuditAction.VerifyOtpSuccess, "user", user.Id,
            user.FullName, AuditOutcome.Success, ct: ct);

        var roleLabelMap = new Dictionary<string, string>
        {
            ["super_admin"] = "مدير النظام الرئيسي",
            ["committee_admin"] = "مدير لجنة قبول",
            ["committee_user"] = "موظف لجنة قبول",
            ["medical_admin"] = "مدير القومسيون الطبي",
            ["medical_doctor"] = "طبيب عيادة",
            ["investigator"] = "محقق",
            ["board_admin"] = "أمين سر الهيئة",
            ["exams_admin"] = "مدير الاختبارات",
            ["biometric_user"] = "مستخدم بوابة الأمن",
            ["records_clerk"] = "مدخل نتائج",
            ["applicant"] = "متقدم",
        };

        return (new VerifyOtpAuthUser(
            user.Id,
            user.NationalId,
            user.FullName,
            user.Role,
            roleLabelMap.GetValueOrDefault(user.Role, user.Role),
            user.Unit,
            RoleApps.ForRole(user.Role),
            RolePermissions.ForRole(user.Role),
            session.Id), null, null, null);
    }
}
