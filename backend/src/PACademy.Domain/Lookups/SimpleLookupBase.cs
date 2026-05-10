namespace PACademy.Domain.Lookups;

/// <summary>
/// Shared shape for the 13 Gap-I lookup catalogue tables that don't carry
/// type-specific columns (educationTypes, maritalStatuses, jobs, etc.).
/// Faculty/Specialty extend this base and add hierarchy/gender columns.
/// </summary>
public abstract class SimpleLookupBase : LookupBase
{
    public string LabelAr { get; protected set; } = string.Empty;
    public string? LabelEn { get; protected set; }
    /// <summary>True for seeded rows that ship with the platform; cannot be hard-deleted.</summary>
    public bool IsSystem { get; protected set; }

    protected void UpdateBase(string? labelAr, string? labelEn, int? sortOrder, bool? isActive)
    {
        if (labelAr is not null) LabelAr = labelAr;
        if (labelEn is not null) LabelEn = labelEn;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
