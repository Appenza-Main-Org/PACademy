using PACademy.Domain.Common;

namespace PACademy.Domain.Lookups;

/// <summary>
/// Shared properties and lifecycle methods for the 21 lookup tables.
/// Not EF-mapped — each derived class registers its own table via its
/// configuration. The protected setters preserve aggregate invariants.
/// </summary>
public abstract class LookupBase : AggregateRoot<Guid>, ISoftDeletable
{
    public string Key { get; protected set; } = string.Empty;
    public int SortOrder { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public bool DemoOrigin { get; protected set; }
    public bool Archived { get; protected set; }
    public DateTime? ArchivedAt { get; protected set; }

    public void Archive()
    {
        Archived = true;
        ArchivedAt = DateTime.UtcNow;
        IsActive = false;
    }

    public void Restore()
    {
        Archived = false;
        ArchivedAt = null;
        IsActive = true;
    }

    public void SetActive(bool isActive) => IsActive = isActive;
    public void Reorder(int sortOrder) => SortOrder = sortOrder;
}
