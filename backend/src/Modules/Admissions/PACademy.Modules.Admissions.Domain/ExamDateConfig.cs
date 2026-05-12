namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Step 11 wizard entity — exam date window for the cycle.
/// Upsert-only (one row per cycle). bookableDays ⊇ blackoutDates invariant.
/// </summary>
public sealed class ExamDateConfig
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public DateTime FirstAvailableDate { get; private set; }
    /// <summary>JSON array of ISO date strings.</summary>
    public string BookableDaysJson { get; private set; } = "[]";
    /// <summary>JSON array of ISO date strings — subset of BookableDays.</summary>
    public string BlackoutDatesJson { get; private set; } = "[]";
    public DateTime UpdatedAt { get; private set; }
    public Guid UpdatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private ExamDateConfig() { }

    public static ExamDateConfig Create(
        Guid cycleId,
        DateTime firstAvailableDate,
        IReadOnlyList<string> bookableDays,
        IReadOnlyList<string> blackoutDates,
        Guid updatedBy)
    {
        ValidateShape(firstAvailableDate, bookableDays, blackoutDates);
        return new ExamDateConfig
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            FirstAvailableDate = firstAvailableDate,
            BookableDaysJson = System.Text.Json.JsonSerializer.Serialize(bookableDays),
            BlackoutDatesJson = System.Text.Json.JsonSerializer.Serialize(blackoutDates),
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        };
    }

    public void Update(
        DateTime firstAvailableDate,
        IReadOnlyList<string> bookableDays,
        IReadOnlyList<string> blackoutDates,
        Guid updatedBy)
    {
        ValidateShape(firstAvailableDate, bookableDays, blackoutDates);
        FirstAvailableDate = firstAvailableDate;
        BookableDaysJson = System.Text.Json.JsonSerializer.Serialize(bookableDays);
        BlackoutDatesJson = System.Text.Json.JsonSerializer.Serialize(blackoutDates);
        UpdatedBy = updatedBy;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateShape(
        DateTime first,
        IReadOnlyList<string> bookableDays,
        IReadOnlyList<string> blackoutDates)
    {
        if (bookableDays.Count == 0)
            throw new ArgumentException("يجب تحديد يوم حجز واحد على الأقل");

        foreach (var day in bookableDays)
        {
            if (!DateTime.TryParse(day, out var parsed) || parsed.Date < first.Date)
                throw new ArgumentException($"يوم الحجز '{day}' يسبق تاريخ أول ميعاد متاح");
        }

        var bookableSet = new HashSet<string>(bookableDays, StringComparer.OrdinalIgnoreCase);
        foreach (var bd in blackoutDates)
        {
            if (!bookableSet.Contains(bd))
                throw new ArgumentException($"يوم الإجازة '{bd}' ليس ضمن أيام الحجز");
        }
    }
}
