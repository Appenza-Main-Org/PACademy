using PACademy.Modules.Notifications.Domain;

namespace PACademy.Modules.Notifications.Application.Templates;

internal static class NotificationTemplateMapper
{
    internal static NotificationTemplateDto ToDto(NotificationTemplate t) => new(
        t.Id,
        t.CycleId,
        t.TriggerEvent.ToString(),
        t.SubjectAr,
        t.BodyAr,
        t.Channel.ToString().ToLowerInvariant(),
        t.IsPublished,
        t.PublishedAt,
        t.CreatedAt,
        Convert.ToBase64String(t.RowVersion));
}
