namespace PACademy.Shared.Domain.Grades;

public sealed class GradeImportRow
{
    private GradeImportRow() { }

    public Guid Id { get; private set; }
    public Guid GradeImportBatchId { get; private set; }
    public int SourceRowIndex { get; private set; }
    public string NationalId { get; private set; } = "";
    public bool IsValid { get; private set; }
    public string PayloadJson { get; private set; } = "{}";
    public string ErrorsJson { get; private set; } = "[]";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    public static GradeImportRow Create(
        int sourceRowIndex,
        string nationalId,
        bool isValid,
        string payloadJson,
        string errorsJson)
    {
        var now = DateTimeOffset.UtcNow;
        return new GradeImportRow
        {
            Id = Guid.NewGuid(),
            SourceRowIndex = sourceRowIndex,
            NationalId = nationalId,
            IsValid = isValid,
            PayloadJson = payloadJson,
            ErrorsJson = errorsJson,
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }
}
