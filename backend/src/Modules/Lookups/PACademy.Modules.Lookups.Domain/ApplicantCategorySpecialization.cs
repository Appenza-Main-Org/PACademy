namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Tier 2 of the Application Settings hierarchy (spec 011).
/// Junction between a category config and a specialization lookup row.
///
/// Carries a sentinel <c>SpecializationId = "__default__"</c> on single-axis
/// categories (e.g. <c>officers_general</c>) so the UI can render the YearTable
/// inline without an explicit specialization picker.
/// </summary>
public sealed class ApplicantCategorySpecialization
{
    public const string ImplicitDefaultSpecializationCode = "__default__";

    private ApplicantCategorySpecialization() { }

    public Guid Id { get; private set; }
    public Guid ConfigId { get; private set; }

    /// <summary>FK → lookup <c>specializations[code]</c>, or the implicit-default sentinel.</summary>
    public string SpecializationId { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = Array.Empty<byte>();

    public static ApplicantCategorySpecialization Create(
        Guid id,
        Guid configId,
        string specializationId,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(specializationId))
            throw new ArgumentException("SpecializationId is required.", nameof(specializationId));

        return new ApplicantCategorySpecialization
        {
            Id = id,
            ConfigId = configId,
            SpecializationId = specializationId,
            IsActive = true,
            CreatedAt = now,
        };
    }
}
