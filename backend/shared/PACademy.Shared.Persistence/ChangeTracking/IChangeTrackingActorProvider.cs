namespace PACademy.Shared.Persistence.ChangeTracking;

/// <summary>
/// Supplies the acting principal for change-tracking stamping, decoupled from
/// ASP.NET so this shared persistence library stays web-framework-free. The
/// admin API implements this over <c>IHttpContextAccessor</c> (reading the
/// <c>X-User-Id</c> header that controllers already rely on).
/// </summary>
public interface IChangeTrackingActorProvider
{
    /// <summary>Current actor user id, or <c>"system"</c> when none is present.</summary>
    string CurrentActorId { get; }
}

/// <summary>Fallback provider used in design-time / tests where no request exists.</summary>
public sealed class SystemActorProvider : IChangeTrackingActorProvider
{
    public string CurrentActorId => "system";
}
