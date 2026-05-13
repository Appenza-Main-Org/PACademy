namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Base shape for the 4 spec 010 mapping tables (FR-008 / FR-009).
/// Each derived entity is a distinct table with a composite PK
/// (CategoryId, TargetId) and a rowversion.
///
/// The mapping rows have no soft-delete — operators delete them
/// outright when they need to remove a binding.
/// </summary>
public abstract class LookupMapping
{
    public Guid CategoryId { get; protected set; }
    public Guid TargetId { get; protected set; }
    public int SortOrder { get; protected set; }
    public DateTimeOffset CreatedAt { get; protected set; }
    public Guid CreatedBy { get; protected set; }
    public byte[] RowVersion { get; protected set; } = Array.Empty<byte>();
}

public sealed class CategorySpecialization : LookupMapping
{
    private CategorySpecialization() { }
    public static CategorySpecialization Create(Guid categoryId, Guid targetId, int sortOrder, Guid actorId, DateTimeOffset now)
        => new()
        {
            CategoryId = categoryId,
            TargetId = targetId,
            SortOrder = sortOrder,
            CreatedAt = now,
            CreatedBy = actorId,
        };
}

public sealed class CategoryCommittee : LookupMapping
{
    private CategoryCommittee() { }
    public static CategoryCommittee Create(Guid categoryId, Guid targetId, int sortOrder, Guid actorId, DateTimeOffset now)
        => new()
        {
            CategoryId = categoryId,
            TargetId = targetId,
            SortOrder = sortOrder,
            CreatedAt = now,
            CreatedBy = actorId,
        };
}

public sealed class CategoryTest : LookupMapping
{
    private CategoryTest() { }
    public static CategoryTest Create(Guid categoryId, Guid targetId, int sortOrder, Guid actorId, DateTimeOffset now)
        => new()
        {
            CategoryId = categoryId,
            TargetId = targetId,
            SortOrder = sortOrder,
            CreatedAt = now,
            CreatedBy = actorId,
        };
}

public sealed class PeriodCategory : LookupMapping
{
    private PeriodCategory() { }
    public static PeriodCategory Create(Guid categoryId, Guid targetId, int sortOrder, Guid actorId, DateTimeOffset now)
        => new()
        {
            CategoryId = categoryId,
            TargetId = targetId,
            SortOrder = sortOrder,
            CreatedAt = now,
            CreatedBy = actorId,
        };
}
