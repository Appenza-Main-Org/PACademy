using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Notifications.Domain;

namespace PACademy.Modules.Notifications.Application;

public interface INotificationsDbContext
{
    DbSet<NotificationTemplate> NotificationTemplates { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
