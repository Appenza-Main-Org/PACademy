namespace PACademy.Modules.Admissions.Domain;

public enum ApplicantStream
{
    General,
    Special,
    Law,
    SportsFemale,
}

public sealed record TotalScoreComponent(string ExamKey, int Weight, int? MinimumPassingScore = null);

/// <summary>
/// Step 13 wizard entity — total score weighting per applicant stream.
/// Invariant: component weights must sum to 100.
/// </summary>
public sealed class TotalScoreConfig
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public ApplicantStream ApplicantStream { get; private set; }
    /// <summary>JSON array of TotalScoreComponent.</summary>
    public string ComponentsJson { get; private set; } = "[]";
    public int TotalScoreOutOf { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid UpdatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private TotalScoreConfig() { }

    public static TotalScoreConfig Create(
        Guid cycleId,
        ApplicantStream applicantStream,
        IReadOnlyList<TotalScoreComponent> components,
        int totalScoreOutOf,
        Guid updatedBy)
    {
        ValidateShape(components, totalScoreOutOf);
        return new TotalScoreConfig
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            ApplicantStream = applicantStream,
            ComponentsJson = System.Text.Json.JsonSerializer.Serialize(components),
            TotalScoreOutOf = totalScoreOutOf,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        };
    }

    public void Update(
        IReadOnlyList<TotalScoreComponent> components,
        int totalScoreOutOf,
        Guid updatedBy)
    {
        ValidateShape(components, totalScoreOutOf);
        ComponentsJson = System.Text.Json.JsonSerializer.Serialize(components);
        TotalScoreOutOf = totalScoreOutOf;
        UpdatedBy = updatedBy;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateShape(IReadOnlyList<TotalScoreComponent> components, int totalScoreOutOf)
    {
        if (components.Count == 0)
            throw new ArgumentException("يجب تحديد مكون واحد على الأقل");

        var sum = components.Sum(c => c.Weight);
        if (sum != 100)
            throw new ArgumentException($"مجموع الأوزان يجب أن يكون 100 — المجموع الحالي {sum}");

        foreach (var c in components)
        {
            if (c.Weight < 0 || c.Weight > 100)
                throw new ArgumentException($"وزن المكون '{c.ExamKey}' خارج النطاق 0–100");
        }

        if (totalScoreOutOf <= 0)
            throw new ArgumentException("المجموع الكلي يجب أن يكون أكبر من صفر");
    }
}
