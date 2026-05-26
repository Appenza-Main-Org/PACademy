namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

public sealed class ApplicantPortalRecordEntity
{
    public string Type { get; set; } = "";
    public string RecordId { get; set; } = "";
    public string ApplicantId { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ExamSlotEntity
{
    public string Id { get; set; } = "";
    public DateOnly Date { get; set; }
    public string Time { get; set; } = "08:00";
    public string Location { get; set; } = "";
    public int Capacity { get; set; }
    public int Reserved { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
