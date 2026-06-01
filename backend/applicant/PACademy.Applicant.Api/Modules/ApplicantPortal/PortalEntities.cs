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

public sealed class ApplicantManagementRecordEntity
{
    public string Module { get; set; } = "";
    public string Id { get; set; } = "";
    public string? ApplicantId { get; set; }
    public string? NationalId { get; set; }
    public string? CycleId { get; set; }
    public string? CommitteeId { get; set; }
    public string? CategoryKey { get; set; }
    public string? Department { get; set; }
    public string? Status { get; set; }
    public string? Kind { get; set; }
    public DateTimeOffset? OccurredAt { get; set; }
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

public sealed class GeneralSettingsReadEntity
{
    public string Id { get; set; } = "";
    public string? AcquaintanceDocumentsEntryResponsibleTestCode { get; set; }
    public string? AcquaintanceDocumentsOpenTiming { get; set; }
    public int? AcquaintanceDocumentsOpenOffsetValue { get; set; }
    public string? AcquaintanceDocumentsOpenOffsetUnit { get; set; }
    public string? AcquaintanceDocumentsCloseResponsibleTestCode { get; set; }
    public string? AcquaintanceDocumentsCloseTiming { get; set; }
    public int? AcquaintanceDocumentsCloseOffsetValue { get; set; }
    public string? AcquaintanceDocumentsCloseOffsetUnit { get; set; }
}

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
