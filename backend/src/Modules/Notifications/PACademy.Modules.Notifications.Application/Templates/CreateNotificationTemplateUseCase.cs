using PACademy.Modules.Notifications.Domain;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class CreateNotificationTemplateUseCase(INotificationsDbContext db, IIdentityApi identity)
{
    public async Task<NotificationTemplateDto> ExecuteAsync(
        CreateNotificationTemplateRequest request, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;

        if (!Enum.TryParse<NotificationTriggerEvent>(request.TriggerEvent, true, out var triggerEvent))
            throw new ArgumentException($"حدث غير صالح: {request.TriggerEvent}");

        if (!Enum.TryParse<NotificationChannel>(request.Channel, true, out var channel))
            throw new ArgumentException($"قناة غير صالحة: {request.Channel}");

        var template = NotificationTemplate.Create(
            request.CycleId, triggerEvent,
            request.SubjectAr, request.BodyAr, channel, actor.Id);

        db.NotificationTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return NotificationTemplateMapper.ToDto(template);
    }
}
