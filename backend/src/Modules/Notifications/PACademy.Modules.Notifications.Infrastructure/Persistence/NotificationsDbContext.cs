using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Notifications.Application;
using PACademy.Modules.Notifications.Domain;

namespace PACademy.Modules.Notifications.Infrastructure.Persistence;

public sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options)
    : DbContext(options), INotificationsDbContext
{
    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfigurationsFromAssembly(typeof(NotificationsDbContext).Assembly);

    Task<int> INotificationsDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
