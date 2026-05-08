using PACademy.Domain.Common;

namespace PACademy.Domain.Sessions;

public sealed class Session : AggregateRoot<Guid>
{
    public Guid UserId { get; private set; }
    public string IpAddress { get; private set; } = string.Empty;
    public string UserAgent { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime LastSeenAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? RevokedReason { get; private set; }

    private Session() { }

    public static Session Create(Guid userId, string ipAddress, string userAgent)
    {
        return new Session
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow,
            LastSeenAt = DateTime.UtcNow,
        };
    }

    public void RefreshLastSeen()
    {
        LastSeenAt = DateTime.UtcNow;
    }

    public void Revoke(string reason)
    {
        RevokedAt = DateTime.UtcNow;
        RevokedReason = reason;
    }
}
