using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PACademy.Infrastructure.Reports;

internal sealed class ReportSnapshotsRefresher(
    IServiceScopeFactory scopeFactory,
    ILogger<ReportSnapshotsRefresher> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Report snapshots refresher started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RefreshAllAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error refreshing report snapshots.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task RefreshAllAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Persistence.PaDbContext>();

        await RefreshRegistrationTempoAsync(db, ct);
        await RefreshStageFunnelAsync(db, ct);
        await RefreshOperationalStatusAsync(db, ct);

        logger.LogDebug("Report snapshots refreshed at {Time}", DateTime.UtcNow);
    }

    private static async Task RefreshRegistrationTempoAsync(Persistence.PaDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("""
            MERGE reports_registration_tempo AS target
            USING (
                SELECT
                    CAST(CreatedAt AS DATE) AS [Date],
                    COUNT(*) AS Total,
                    GETUTCDATE() AS LastRefreshedAt
                FROM applicants
                WHERE Archived = 0
                GROUP BY CAST(CreatedAt AS DATE)
            ) AS source ON target.[Date] = source.[Date]
            WHEN MATCHED THEN
                UPDATE SET
                    target.Total = source.Total,
                    target.LastRefreshedAt = source.LastRefreshedAt
            WHEN NOT MATCHED THEN
                INSERT ([Date], Total, LastRefreshedAt)
                VALUES (source.[Date], source.Total, source.LastRefreshedAt);
            """, ct);
    }

    private static async Task RefreshStageFunnelAsync(Persistence.PaDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("""
            MERGE reports_stage_funnel AS target
            USING (
                SELECT
                    Status,
                    COUNT(*) AS Total,
                    GETUTCDATE() AS LastRefreshedAt
                FROM applicants
                WHERE Archived = 0
                GROUP BY Status
            ) AS source ON target.Status = source.Status
            WHEN MATCHED THEN
                UPDATE SET
                    target.Total = source.Total,
                    target.LastRefreshedAt = source.LastRefreshedAt
            WHEN NOT MATCHED THEN
                INSERT (Status, Total, LastRefreshedAt)
                VALUES (source.Status, source.Total, source.LastRefreshedAt);
            """, ct);
    }

    private static async Task RefreshOperationalStatusAsync(Persistence.PaDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("""
            MERGE reports_operational_status AS target
            USING (
                SELECT
                    (SELECT COUNT(*) FROM applicants WHERE Archived = 0) AS TotalApplicants,
                    (SELECT COUNT(*) FROM cycles WHERE Archived = 0 AND Status = 'Active') AS ActiveCycles,
                    (SELECT COUNT(*) FROM system_users WHERE Archived = 0 AND IsActive = 1) AS ActiveUsers,
                    (SELECT COUNT(*) FROM audit_entries WHERE OccurredAt >= DATEADD(HOUR, -24, GETUTCDATE())) AS AuditEntriesLast24h,
                    GETUTCDATE() AS LastRefreshedAt
            ) AS source ON 1 = 1
            WHEN MATCHED THEN
                UPDATE SET
                    target.TotalApplicants = source.TotalApplicants,
                    target.ActiveCycles = source.ActiveCycles,
                    target.ActiveUsers = source.ActiveUsers,
                    target.AuditEntriesLast24h = source.AuditEntriesLast24h,
                    target.LastRefreshedAt = source.LastRefreshedAt
            WHEN NOT MATCHED THEN
                INSERT (TotalApplicants, ActiveCycles, ActiveUsers, AuditEntriesLast24h, LastRefreshedAt)
                VALUES (source.TotalApplicants, source.ActiveCycles, source.ActiveUsers, source.AuditEntriesLast24h, source.LastRefreshedAt);
            """, ct);
    }
}
