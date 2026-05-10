using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PACademy.Modules.Identity.Infrastructure.Persistence;

namespace PACademy.Api.Hosting;

public sealed class OtpExpirySweeper(IServiceScopeFactory scopeFactory, ILogger<OtpExpirySweeper> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

                // Sweep: delete rows expired more than 24h ago (24h grace for forensics)
                var cutoff = DateTime.UtcNow.AddHours(-24);
                var deleted = await db.PendingOtps
                    .Where(p => p.ExpiresAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deleted > 0)
                    logger.LogDebug("OTP expiry sweep: deleted {Count} expired rows", deleted);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "OTP expiry sweep failed");
            }
        }
    }
}
