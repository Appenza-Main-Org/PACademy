namespace PACademy.Modules.Identity.Domain;

public sealed class LockPolicy
{
    public int Id { get; private set; } = 1;
    public int MaxFailedAttempts { get; private set; }
    public int LockDurationMinutes { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public bool DemoOrigin { get; private set; }

    private LockPolicy() { }

    public static LockPolicy Default() =>
        new()
        {
            Id = 1,
            MaxFailedAttempts = 5,
            LockDurationMinutes = 30,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = null,
            DemoOrigin = true,
        };

    public void Update(int? maxFailedAttempts, int? lockDurationMinutes, Guid updatedBy)
    {
        if (maxFailedAttempts.HasValue)
        {
            if (maxFailedAttempts.Value < 1 || maxFailedAttempts.Value > 10)
                throw new ArgumentOutOfRangeException(nameof(maxFailedAttempts), "Must be between 1 and 10.");
            MaxFailedAttempts = maxFailedAttempts.Value;
        }

        if (lockDurationMinutes.HasValue)
        {
            if (lockDurationMinutes.Value < 5 || lockDurationMinutes.Value > 120)
                throw new ArgumentOutOfRangeException(nameof(lockDurationMinutes), "Must be between 5 and 120.");
            LockDurationMinutes = lockDurationMinutes.Value;
        }

        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
