using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Persistence;

/// <summary>
/// JSON-blob store for applicant portal state: draft, payment, exam
/// reservation, family. PK is (type, record_id) so each applicant can
/// have exactly one draft but multiple payment attempts.
/// Schema owned by the admin backend; applicant backend reads/writes via
/// its own ApplicantPortalDbContext (no migrations assembly).
/// </summary>
public sealed class ApplicantPortalRecordEntity
{
    /// <summary>draft | payment | exam_reservation | family</summary>
    public string Type { get; set; } = "";
    /// <summary>For draft/exam_reservation/family: NationalId. For payment: refNumber.</summary>
    public string RecordId { get; set; } = "";
    public string ApplicantId { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

/// <summary>
/// Exam slot available for applicants to pick. Seeded by admin when
/// configuring committee instances for the active cycle.
/// </summary>
public sealed class ExamSlotEntity : IChangeTracked
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
    public string? LastModifiedBy { get; set; }
    public string? SourceSystem { get; set; } = ChangeTrackingColumns.DefaultSourceSystem;
    public string? Checksum { get; set; }
}
