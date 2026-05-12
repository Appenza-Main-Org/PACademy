using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class GetNotificationTemplateUseCase(INotificationsDbContext db)
{
    public async Task<NotificationTemplateDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var t = await db.NotificationTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? null : NotificationTemplateMapper.ToDto(t);
    }
}
