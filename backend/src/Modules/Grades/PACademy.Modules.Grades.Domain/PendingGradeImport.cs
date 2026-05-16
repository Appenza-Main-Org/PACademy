namespace PACademy.Modules.Grades.Domain;

/// <summary>
/// Server-side staging entry for the v1 import wizard. Persists the
/// parsed rows + duplicate analysis between the stage and commit HTTP
/// calls so the client only round-trips lightweight resolution decisions.
/// Rows are stored as JSON (NewRowsJson / DuplicatesJson) — the use case
/// layer serialises the typed payloads.
/// </summary>
public sealed class PendingGradeImport
{
    public Guid Id { get; private set; }
    public GradeKind Kind { get; private set; }
    public decimal MaxDegree { get; private set; }
    public string NewRowsJson { get; private set; } = "[]";
    public string DuplicatesJson { get; private set; } = "[]";
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }

    private PendingGradeImport() { }

    public static PendingGradeImport Create(
        GradeKind kind,
        decimal maxDegree,
        string newRowsJson,
        string duplicatesJson,
        Guid createdBy)
        => new()
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            MaxDegree = maxDegree,
            NewRowsJson = newRowsJson,
            DuplicatesJson = duplicatesJson,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
}
