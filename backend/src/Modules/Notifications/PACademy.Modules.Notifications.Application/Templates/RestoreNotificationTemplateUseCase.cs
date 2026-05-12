using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class RestoreNotificationTemplateUseCase(INotificationsDbContext db)
{
    public async Task<NotificationTemplateDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var t = await db.NotificationTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return null;
        t.Restore();
        await db.SaveChangesAsync(ct);
        return NotificationTemplateMapper.ToDto(t);
    }
}
