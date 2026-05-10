using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PACademy.Modules.Identity.Infrastructure.Persistence;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Api.Hosting;

public sealed class LockoutAutoUnlockSweeper(IServiceScopeFactory scopeFactory, ILogger<LockoutAutoUnlockSweeper> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
                var auditApi = scope.ServiceProvider.GetRequiredService<IAuditApi>();

                var now = DateTime.UtcNow;
                var expired = await db.LockoutStates
                    .Where(l => l.UnlocksAt < now)
                    .ToListAsync(stoppingToken);

                foreach (var lockout in expired)
                {
                    db.LockoutStates.Remove(lockout);
                    await auditApi.RecordAsync(
                        AuditAction.LockoutAutoCleared, "user", lockout.UserId,
                        lockout.UserId.ToString(), AuditOutcome.Success,
                        ct: stoppingToken);
                }

                if (expired.Count > 0)
                {
                    await db.SaveChangesAsync(stoppingToken);
                    logger.LogDebug("Lockout auto-unlock: cleared {Count} expired lockouts", expired.Count);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Lockout auto-unlock sweep failed");
            }
        }
    }
}
