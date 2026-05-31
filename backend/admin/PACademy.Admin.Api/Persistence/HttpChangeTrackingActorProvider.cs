using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Persistence;

/// <summary>
/// Resolves the change-tracking actor from the <c>X-User-Id</c> request header —
/// the same header <c>AdminRecordsService</c> reads for audit emission — falling
/// back to <c>"system"</c> when no request context is present (seeders, jobs).
/// </summary>
public sealed class HttpChangeTrackingActorProvider(IHttpContextAccessor accessor) : IChangeTrackingActorProvider
{
    public string CurrentActorId
    {
        get
        {
            var header = accessor.HttpContext?.Request.Headers["X-User-Id"].FirstOrDefault();
            return string.IsNullOrWhiteSpace(header) ? "system" : header;
        }
    }
}
