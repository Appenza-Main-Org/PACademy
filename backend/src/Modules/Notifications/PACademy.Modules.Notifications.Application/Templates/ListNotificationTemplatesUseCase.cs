using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class ListNotificationTemplatesUseCase(INotificationsDbContext db)
{
    public async Task<IReadOnlyList<NotificationTemplateDto>> ExecuteAsync(
        Guid? cycleId, string? triggerEvent, bool? isPublished,
        CancellationToken ct = default)
    {
        var query = db.NotificationTemplates
            .Where(t => t.DeletedAt == null)
            .AsQueryable();

        if (cycleId.HasValue)
            query = query.Where(t => t.CycleId == cycleId);

        if (!string.IsNullOrWhiteSpace(triggerEvent) &&
            Enum.TryParse<Domain.NotificationTriggerEvent>(triggerEvent, true, out var ev))
            query = query.Where(t => t.TriggerEvent == ev);

        if (isPublished.HasValue)
            query = query.Where(t => t.IsPublished == isPublished.Value);

        var list = await query.OrderByDescending(t => t.CreatedAt).ToListAsync(ct);
        return list.Select(NotificationTemplateMapper.ToDto).ToList();
    }
}
