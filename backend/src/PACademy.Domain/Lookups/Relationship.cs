namespace PACademy.Domain.Lookups;

public enum RelationshipSide { Paternal, Maternal, Spouse, Self }

public sealed class Relationship : LookupBase
{
    public string NameAr { get; private set; } = string.Empty;
    public int Degree { get; private set; }
    public RelationshipSide Side { get; private set; }

    private Relationship() { }

    public static Relationship Create(
        string key, string nameAr, int degree, RelationshipSide side,
        int sortOrder = 0, bool demoOrigin = false)
    {
        if (degree < 1 || degree > 4)
            throw new ArgumentOutOfRangeException(nameof(degree), "Degree must be between 1 and 4.");
        return new Relationship
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            Degree = degree,
            Side = side,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }

    public void Update(string? nameAr, int? degree, RelationshipSide? side, int? sortOrder, bool? isActive)
    {
        if (nameAr is not null) NameAr = nameAr;
        if (degree.HasValue)
        {
            if (degree.Value < 1 || degree.Value > 4)
                throw new ArgumentOutOfRangeException(nameof(degree), "Degree must be between 1 and 4.");
            Degree = degree.Value;
        }
        if (side.HasValue) Side = side.Value;
        if (sortOrder.HasValue) SortOrder = sortOrder.Value;
        if (isActive.HasValue) IsActive = isActive.Value;
    }
}
