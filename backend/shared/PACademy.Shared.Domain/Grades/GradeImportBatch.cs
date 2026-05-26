namespace PACademy.Shared.Domain.Grades;

public sealed class GradeImportBatch
{
    private readonly List<GradeImportRow> _rows = [];

    private GradeImportBatch() { }

    public Guid Id { get; private set; }
    public string SourceFormat { get; private set; } = default!;
    public string Status { get; private set; } = default!;
    public int? GraduationYear { get; private set; }
    public string SelectedSchoolCategoriesJson { get; private set; } = "[]";
    public string MaxGradeByCategoryJson { get; private set; } = "{}";
    public int TotalRows { get; private set; }
    public int ValidRows { get; private set; }
    public int InvalidRows { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;
    public IReadOnlyCollection<GradeImportRow> Rows => _rows;

    public static GradeImportBatch Create(
        string sourceFormat,
        int? graduationYear,
        string selectedSchoolCategoriesJson,
        string maxGradeByCategoryJson,
        int totalRows,
        int validRows,
        int invalidRows)
    {
        var now = DateTimeOffset.UtcNow;
        return new GradeImportBatch
        {
            Id = Guid.NewGuid(),
            SourceFormat = sourceFormat,
            Status = "staged",
            GraduationYear = graduationYear,
            SelectedSchoolCategoriesJson = selectedSchoolCategoriesJson,
            MaxGradeByCategoryJson = maxGradeByCategoryJson,
            TotalRows = totalRows,
            ValidRows = validRows,
            InvalidRows = invalidRows,
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void AddRow(GradeImportRow row) => _rows.Add(row);

    public void MarkCommitted()
    {
        Status = "committed";
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
