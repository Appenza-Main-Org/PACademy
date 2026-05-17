namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Tier 1 of the Application Settings hierarchy (spec 011).
/// Surfaces a row from the <c>applicant-categories</c> lookup in the admission funnel.
/// </summary>
public sealed class ApplicantCategoryConfig
{
    private ApplicantCategoryConfig() { }

    public Guid Id { get; private set; }

    /// <summary>FK → lookup <c>applicant-categories[code]</c>.</summary>
    public string CategoryId { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = Array.Empty<byte>();

    public static ApplicantCategoryConfig Create(
        Guid id,
        string categoryId,
        int sortOrder,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(categoryId))
            throw new ArgumentException("CategoryId is required.", nameof(categoryId));

        return new ApplicantCategoryConfig
        {
            Id = id,
            CategoryId = categoryId,
            IsActive = true,
            SortOrder = sortOrder,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void SetActive(bool isActive, DateTimeOffset now)
    {
        IsActive = isActive;
        UpdatedAt = now;
    }

    public void UpdateSortOrder(int sortOrder, DateTimeOffset now)
    {
        SortOrder = sortOrder;
        UpdatedAt = now;
    }
}
