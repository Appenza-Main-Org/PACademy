using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.OperationalRecords;

public abstract class OperationalRecordEntity
{
    public required string Module { get; set; }
    public required string Id { get; set; }
    public string? ApplicantId { get; set; }
    public string? NationalId { get; set; }
    public string? CycleId { get; set; }
    public string? CommitteeId { get; set; }
    public string? CategoryKey { get; set; }
    public string? Department { get; set; }
    public string? Status { get; set; }
    public string? Kind { get; set; }
    public DateTimeOffset? OccurredAt { get; set; }
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class PaymentRecordEntity : OperationalRecordEntity;
public sealed class ApplicantManagementRecordEntity : OperationalRecordEntity;
public sealed class GradeOperationalRecordEntity : OperationalRecordEntity;
public sealed class NotificationRecordEntity : OperationalRecordEntity;
public sealed class WorkflowRecordEntity : OperationalRecordEntity;
public sealed class CommitteeRecordEntity : OperationalRecordEntity;
public sealed class ExamOperationalRecordEntity : OperationalRecordEntity;
public sealed class BiometricRecordEntity : OperationalRecordEntity;
public sealed class AdmissionSetupRecordEntity : OperationalRecordEntity;
public sealed class ReportSnapshotRecordEntity : OperationalRecordEntity;

public interface IOperationalRecordsDbContext
{
    DbSet<PaymentRecordEntity> PaymentRecords { get; }
    DbSet<ApplicantManagementRecordEntity> ApplicantManagementRecords { get; }
    DbSet<GradeOperationalRecordEntity> GradeOperationalRecords { get; }
    DbSet<NotificationRecordEntity> NotificationRecords { get; }
    DbSet<WorkflowRecordEntity> WorkflowRecords { get; }
    DbSet<CommitteeRecordEntity> CommitteeRecords { get; }
    DbSet<ExamOperationalRecordEntity> ExamOperationalRecords { get; }
    DbSet<BiometricRecordEntity> BiometricRecords { get; }
    DbSet<AdmissionSetupRecordEntity> AdmissionSetupRecords { get; }
    DbSet<ReportSnapshotRecordEntity> ReportSnapshotRecords { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
