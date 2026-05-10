using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.Auth;
using PACademy.Modules.Identity.Domain;
using PACademy.Modules.Identity.Infrastructure.Persistence;

namespace PACademy.Modules.Identity.Infrastructure.Otp;

public sealed class SqlPendingOtpStore(IdentityDbContext db) : IPendingOtpStore
{
    public async Task<PendingOtp> CreateAsync(
        Guid userId, string codeHash, string maskedPhoneTail, int validityMinutes,
        CancellationToken ct = default)
    {
        // Invalidate any prior un-consumed rows for this user (concurrent OTP requests edge case)
        var prior = await db.PendingOtps
            .Where(p => p.UserId == userId && p.ConsumedAt == null)
            .ToListAsync(ct);
        foreach (var p in prior) p.MarkConsumed();

        var pendingOtp = PendingOtp.Create(userId, codeHash, maskedPhoneTail, validityMinutes);
        db.PendingOtps.Add(pendingOtp);
        await db.SaveChangesAsync(ct);
        return pendingOtp;
    }

    public async Task<PendingOtp?> GetAsync(Guid pendingId, CancellationToken ct = default) =>
        await db.PendingOtps.FindAsync([pendingId], ct);

    public async Task ConsumeAsync(Guid pendingId, CancellationToken ct = default)
    {
        var row = await db.PendingOtps.FindAsync([pendingId], ct);
        if (row is null) return;
        row.MarkConsumed();
        await db.SaveChangesAsync(ct);
    }

    public async Task IncrementAttemptAsync(Guid pendingId, CancellationToken ct = default)
    {
        var row = await db.PendingOtps.FindAsync([pendingId], ct);
        if (row is null) return;
        row.IncrementAttempt();
        await db.SaveChangesAsync(ct);
    }

    public async Task InvalidateAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var rows = await db.PendingOtps
            .Where(p => p.UserId == userId && p.ConsumedAt == null)
            .ToListAsync(ct);
        foreach (var r in rows) r.MarkConsumed();
        await db.SaveChangesAsync(ct);
    }
}
