namespace PACademy.Admin.Api.Infrastructure;

/// <summary>
/// Rate-limits the committee-instance reservation sweep. The sweep loads
/// every applicant and recomputes counts for every instance — too heavy to
/// run on each 10-second client poll, and the cost multiplies per open
/// admin tab. Registered as a singleton so at most one sweep runs per
/// interval process-wide; persisted counts serve reads between sweeps, so
/// staleness is bounded by the interval. The explicit refresh endpoint
/// bypasses this throttle.
/// </summary>
public sealed class ReservationSweepThrottle(TimeSpan interval)
{
    private readonly object gate = new();
    private DateTimeOffset nextSweepAt = DateTimeOffset.MinValue;

    /// <summary>
    /// True when the caller should run the sweep now; claiming moves the
    /// next eligible time forward so concurrent callers skip.
    /// </summary>
    public bool TryClaim()
    {
        lock (gate)
        {
            var now = DateTimeOffset.UtcNow;
            if (now < nextSweepAt) return false;
            nextSweepAt = now + interval;
            return true;
        }
    }
}
