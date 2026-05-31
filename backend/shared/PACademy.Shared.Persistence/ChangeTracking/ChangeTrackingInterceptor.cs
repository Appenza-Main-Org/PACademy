using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace PACademy.Shared.Persistence.ChangeTracking;

/// <summary>
/// On every save, stamps change-tracking metadata onto entities implementing
/// <see cref="IChangeTracked"/>:
/// <list type="bullet">
///   <item><c>created_at</c> — set once, on insert, if still default.</item>
///   <item><c>updated_at</c> — refreshed to <c>SYSUTCDATETIME()</c> on insert + update.</item>
///   <item><c>last_modified_by</c> — current principal (from the actor provider).</item>
///   <item><c>source_system</c> — defaults to <c>appenza-admin</c>; left intact when an
///         import has already set it (so imported provenance survives).</item>
///   <item><c>checksum</c> — recomputed over the row's data columns only
///         (<see cref="RowChecksum"/>), excluding the six tracking columns.</item>
/// </list>
/// <c>row_version</c> is the DB <c>rowversion</c> and is never touched here.
/// </summary>
public sealed class ChangeTrackingInterceptor(IChangeTrackingActorProvider actor) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData, InterceptionResult<int> result)
    {
        Stamp(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Stamp(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Stamp(DbContext? context)
    {
        if (context is null) return;

        var now = DateTimeOffset.UtcNow;
        var actorId = actor.CurrentActorId;

        foreach (var entry in context.ChangeTracker.Entries<IChangeTracked>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
                continue;

            var tracked = entry.Entity;

            if (entry.State == EntityState.Added && tracked.CreatedAt == default)
                tracked.CreatedAt = now;

            tracked.UpdatedAt = now;
            tracked.LastModifiedBy = actorId;
            if (string.IsNullOrWhiteSpace(tracked.SourceSystem))
                tracked.SourceSystem = ChangeTrackingColumns.DefaultSourceSystem;

            tracked.Checksum = ComputeChecksum(entry);
        }
    }

    private static string ComputeChecksum(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var columns = entry.Properties.Select(p =>
            new KeyValuePair<string, object?>(ColumnName(p), p.CurrentValue));
        return RowChecksum.Compute(columns);
    }

    private static string ColumnName(Microsoft.EntityFrameworkCore.ChangeTracking.PropertyEntry property)
    {
        // Relational column name (snake_case via HasColumnName) is the contract.
        // Fall back to the CLR property name under non-relational providers (tests).
        try
        {
            return property.Metadata.GetColumnName() ?? property.Metadata.Name;
        }
        catch (InvalidOperationException)
        {
            return property.Metadata.Name;
        }
    }
}
