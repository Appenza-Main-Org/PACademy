namespace PACademy.Modules.Identity.Domain;

public sealed class PendingOtp
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string CodeHash { get; private set; } = string.Empty;
    public string MaskedPhoneTail { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public int AttemptCount { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ConsumedAt { get; private set; }

    private PendingOtp() { }

    public static PendingOtp Create(Guid userId, string codeHash, string maskedPhoneTail, int validityMinutes = 5)
    {
        return new PendingOtp
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CodeHash = codeHash,
            MaskedPhoneTail = maskedPhoneTail,
            ExpiresAt = DateTime.UtcNow.AddMinutes(validityMinutes),
            AttemptCount = 0,
            CreatedAt = DateTime.UtcNow,
            ConsumedAt = null,
        };
    }

    public void MarkConsumed() => ConsumedAt = DateTime.UtcNow;

    public void IncrementAttempt() => AttemptCount++;

    public bool IsExpired(DateTime now) => now >= ExpiresAt;

    public bool IsConsumed => ConsumedAt.HasValue;
}
