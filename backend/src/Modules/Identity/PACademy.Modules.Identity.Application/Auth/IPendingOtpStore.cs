using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Application.Auth;

public interface IPendingOtpStore
{
    Task<PendingOtp> CreateAsync(Guid userId, string codeHash, string maskedPhoneTail, int validityMinutes, CancellationToken ct = default);
    Task<PendingOtp?> GetAsync(Guid pendingId, CancellationToken ct = default);
    Task ConsumeAsync(Guid pendingId, CancellationToken ct = default);
    Task IncrementAttemptAsync(Guid pendingId, CancellationToken ct = default);
    Task InvalidateAllForUserAsync(Guid userId, CancellationToken ct = default);
}
