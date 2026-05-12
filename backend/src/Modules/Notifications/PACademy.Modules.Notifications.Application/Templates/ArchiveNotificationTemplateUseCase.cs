using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Identity.Public;

namespace PACademy.Modules.Notifications.Application.Templates;

public sealed class ArchiveNotificationTemplateUseCase(INotificationsDbContext db, IIdentityApi identity)
{
    public async Task<bool> ExecuteAsync(Guid id, string? reason, CancellationToken ct = default)
    {
        var actor = (await identity.GetCurrentUserAsync(ct))!;
        var t = await db.NotificationTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return false;
        t.Archive(actor.Id, reason);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
