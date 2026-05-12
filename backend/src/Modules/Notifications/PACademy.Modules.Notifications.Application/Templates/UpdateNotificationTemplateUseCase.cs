using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class UpdateNotificationTemplateUseCase(INotificationsDbContext db)
{
    public async Task<NotificationTemplateDto?> ExecuteAsync(
        Guid id, UpdateNotificationTemplateRequest request, CancellationToken ct = default)
    {
        var t = await db.NotificationTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return null;
        t.Update(request.SubjectAr, request.BodyAr);
        await db.SaveChangesAsync(ct);
        return NotificationTemplateMapper.ToDto(t);
    }
}
