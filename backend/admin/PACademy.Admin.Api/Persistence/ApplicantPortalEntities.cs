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

/// <summary>
/// Backend-owned rules that decide when an applicant's acquaintance document
/// opens and closes for a cycle. Admin migrations own this table; applicant
/// APIs read it while enforcing applicant-side edit/print permissions.
/// </summary>
public sealed class AcquaintanceDocSettingsEntity
{
    public string Id { get; set; } = "";
    public string CycleId { get; set; } = "";
    public string OpeningTestKey { get; set; } = "";
    public string OpeningRequiredOutcome { get; set; } = "passed";
    public string ClosingTestKey { get; set; } = "";
    public string ClosingMode { get; set; } = "after_test_passed";
    public DateTimeOffset? ClosingAt { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

/// <summary>
/// Root lifecycle row for one applicant acquaintance document in one cycle.
/// Section data is split into <see cref="ApplicantAcquaintanceDocSectionEntity"/>
/// rows to avoid the old single-document JSON blob storage model.
/// </summary>
public sealed class ApplicantAcquaintanceDocEntity
{
    public string Id { get; set; } = "";
    public string CycleId { get; set; } = "";
    public string ApplicantId { get; set; } = "";
    public string Status { get; set; } = "open";
    public DateTimeOffset? OpenedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public DateTimeOffset? LastAutosavedAt { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<ApplicantAcquaintanceDocSectionEntity> Sections { get; set; } = [];
}

public sealed class ApplicantAcquaintanceDocSectionEntity
{
    public string Id { get; set; } = "";
    public string AcquaintanceDocId { get; set; } = "";
    public string SectionKey { get; set; } = "";
    public string DataJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ApplicantAcquaintanceDocRevisionEntity
{
    public string Id { get; set; } = "";
    public string AcquaintanceDocId { get; set; } = "";
    public int Version { get; set; }
    public string ChangeKind { get; set; } = "autosave";
    public string ChangedSectionKeysJson { get; set; } = "[]";
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// Per-(cycle × committee) running counter backing the SSSSS segment of the
/// applicant barcode (format YY BYY MM DD G CC SSSSS). One row per committee
/// per cycle; <see cref="NextSequence"/> is the next free 1-based number.
/// Allocation is a transactional read-increment-save guarded by RowVersion so
/// concurrent bookings into the same committee never collide. The number is
/// never returned to the pool, so a reversed payment cannot reassign it.
/// Schema owned by the admin backend; the applicant backend reads/writes via
/// its own PortalDbContext (no migrations assembly).
/// </summary>
public sealed class BarcodeSequenceEntity
{
    public string CycleId { get; set; } = "";
    public string CommitteeCode { get; set; } = "";
    public int NextSequence { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
