namespace PACademy.Modules.Identity.Domain;

public sealed class LockoutState
{
    public Guid UserId { get; private set; }
    public DateTime LockedAt { get; private set; }
    public DateTime UnlocksAt { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public int FailedAttemptCount { get; private set; }

    private LockoutState() { }

    public static LockoutState Create(Guid userId, int lockDurationMinutes, string reason, int failedAttemptCount)
    {
        var now = DateTime.UtcNow;
        return new LockoutState
        {
            UserId = userId,
            LockedAt = now,
            UnlocksAt = now.AddMinutes(lockDurationMinutes),
            Reason = reason,
            FailedAttemptCount = failedAttemptCount,
        };
    }

    public bool IsExpired(DateTime now) => now >= UnlocksAt;
}
