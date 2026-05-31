namespace PACademy.Shared.Persistence.ChangeTracking;

/// <summary>
/// Marks an entity as carrying creation + modification tracking for the
/// Data-Exchange pipeline. Every exchangeable row implements this so that
/// export/import can surface <c>created_at</c>/<c>updated_at</c>, version the
/// row, and detect change via a stable <c>checksum</c>.
///
/// <para>
/// Three of the six tracking members already exist on the admin entities by
/// convention (<see cref="CreatedAt"/>, <see cref="UpdatedAt"/>,
/// <c>RowVersion</c> mapped <c>IsRowVersion()</c>); this interface adds the
/// remaining three (<see cref="LastModifiedBy"/>, <see cref="SourceSystem"/>,
/// <see cref="Checksum"/>) and is the contract the
/// <see cref="ChangeTrackingInterceptor"/> stamps on save.
/// </para>
///
/// <para>
/// <see cref="ChangeTrackingColumns"/> lists the column names the checksum
/// MUST exclude (the tracking columns are never part of a row's data hash).
/// </para>
/// </summary>
public interface IChangeTracked
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Actor (user id) of the last write. Stamped from the principal.</summary>
    string? LastModifiedBy { get; set; }

    /// <summary>Originating system. Defaults to <c>appenza-admin</c>; an import overrides it.</summary>
    string? SourceSystem { get; set; }

    /// <summary>Stable hash of the row's data columns only (see <see cref="RowChecksum"/>).</summary>
    string? Checksum { get; set; }
}

/// <summary>
/// The six tracking column names that are EXCLUDED from every row checksum.
/// Shared by the interceptor and (mirrored verbatim by) the frontend mock so
/// both sides compute the same hash over the same data-only field set.
/// </summary>
public static class ChangeTrackingColumns
{
    public const string CreatedAt = "created_at";
    public const string UpdatedAt = "updated_at";
    public const string RowVersion = "row_version";
    public const string LastModifiedBy = "last_modified_by";
    public const string SourceSystem = "source_system";
    public const string Checksum = "checksum";

    public const string DefaultSourceSystem = "appenza-admin";

    /// <summary>Set of excluded column names (ordinal-ignore-case).</summary>
    public static readonly IReadOnlySet<string> Excluded = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase)
    {
        CreatedAt,
        UpdatedAt,
        RowVersion,
        LastModifiedBy,
        SourceSystem,
        Checksum,
    };
}
