using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Domain;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Identity.Application.Auth;

public sealed record RequestOtpResult(
    string Code,
    Guid PendingId,
    string OtpDevice,
    DateTime OtpExpiresAt);

public sealed record RequestOtpLockedResult(
    DateTime UnlocksAt,
    string Reason);

public sealed class RequestOtpUseCase(
    UserManager<SystemUser> userManager,
    IIdentityDbContext db,
    IPendingOtpStore otpStore,
    IOtpTransport otpTransport,
    OtpCodeHasher hasher,
    IAuditApi audit)
{
    private const int ValidityMinutes = 5;
    private static readonly Guid AnonymousActorId = Guid.Empty;

    public async Task<(RequestOtpResult? Ok, string? ErrorCode, RequestOtpLockedResult? Locked)> ExecuteAsync(
        string nationalId,
        string password,
        CancellationToken ct = default)
    {
        var user = await userManager.FindByNameAsync(nationalId);
        if (user is null || !await userManager.CheckPasswordAsync(user, password))
        {
            await audit.RecordAsync(
                AuditAction.RequestOtp, "user", AnonymousActorId, nationalId,
                AuditOutcome.Failure, ct: ct);
            return (null, ErrorCodes.InvalidCredentials, null);
        }

        // Check lockout
        var lockout = await db.LockoutStates.FindAsync([user.Id], ct);
        if (lockout is not null)
        {
            await audit.RecordAsync(
                AuditAction.RequestOtp, "user", user.Id, user.FullName,
                AuditOutcome.Failure, ct: ct);
            return (null, ErrorCodes.AccountLocked, new RequestOtpLockedResult(lockout.UnlocksAt, lockout.Reason));
        }

        // Generate 6-digit code
        var code = GenerateCode();
        var codeHash = hasher.Hash(code);
        var maskedTail = MaskPhone(user.PhoneNumber ?? user.Mobile);

        var pending = await otpStore.CreateAsync(
            user.Id, codeHash, maskedTail, ValidityMinutes, ct);

        await otpTransport.SendAsync(maskedTail, user.PhoneNumber ?? user.Mobile, code, ct);

        await audit.RecordAsync(
            AuditAction.RequestOtp, "user", user.Id, user.FullName,
            AuditOutcome.Success, ct: ct);

        return (new RequestOtpResult(code, pending.Id, maskedTail, pending.ExpiresAt), null, null);
    }

    private static string GenerateCode() =>
        Random.Shared.Next(0, 1_000_000).ToString("D6");

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 4)
            return "•••• ????";
        var tail = phone[^4..];
        return $"•••• {tail}";
    }
}
