using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.Committees;
using PACademy.Admin.Api.Modules.Payments;
using PACademy.Admin.Api.Modules.Biometric;
using PACademy.Admin.Api.Modules.Notifications;
using PACademy.Admin.Api.Modules.Workflows;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Persistence;

public sealed class AdminDbContext(DbContextOptions<AdminDbContext> options) : DbContext(options), ILookupsDbContext, IAuditDbContext, IAdmissionsDbContext, IIdentityDbContext, IAdminRecordsDbContext, IExamsDbContext, IGeneralSettingsDbContext, IOperationalRecordsDbContext
{
    // Canonical schema for ALL admin EF tables. Environment separation is by
    // DATABASE (DB_PAcademy_Prod / DB_PAcademy_Staging), never by schema, so this
    // stays "dbo". (Overridable via Database:Schema / ADMIN_DB_SCHEMA for legacy
    // setups, but production/staging no longer set it.)
    public const string DefaultSchema = "dbo";
    public const string MigrationsHistoryTable = "__EFMigrationsHistory_AdminApi";
    public static string Schema { get; private set; } = DefaultSchema;

    public static void ConfigureSchema(string schema)
    {
        Schema = NormalizeSchema(schema);
    }

    public static string NormalizeSchema(string schema)
    {
        var trimmed = schema.Trim();
        if (trimmed.Length == 0)
            return DefaultSchema;

        if (trimmed.Any(c => !(char.IsLetterOrDigit(c) || c == '_')))
            throw new InvalidOperationException("Database schema may only contain letters, numbers, and underscores.");

        return trimmed;
    }

    public static string QualifiedTableName(string tableName)
    {
        if (tableName.Any(c => !(char.IsLetterOrDigit(c) || c == '_')))
            throw new InvalidOperationException("Database table name may only contain letters, numbers, and underscores.");

        return $"[{Schema}].[{tableName}]";
    }

    public DbSet<LookupRowEntity> LookupRows => Set<LookupRowEntity>();
    public DbSet<AuditRowEntity> AuditRows => Set<AuditRowEntity>();
    public DbSet<AdmissionCycleEntity> AdmissionCycles => Set<AdmissionCycleEntity>();
    public DbSet<ApplicantCategoryEntity> ApplicantCategories => Set<ApplicantCategoryEntity>();
    public DbSet<AdmissionRuleEntity> AdmissionRules => Set<AdmissionRuleEntity>();
    public DbSet<ApplicationSettingsCategoryConfigEntity> ApplicationSettingsCategoryConfigs => Set<ApplicationSettingsCategoryConfigEntity>();
    public DbSet<ApplicationSettingsCategorySpecializationEntity> ApplicationSettingsCategorySpecializations => Set<ApplicationSettingsCategorySpecializationEntity>();
    public DbSet<ApplicationSettingsGraduationYearEntity> ApplicationSettingsGraduationYears => Set<ApplicationSettingsGraduationYearEntity>();
    public DbSet<CategoryEducationFieldEntity> CategoryEducationFields => Set<CategoryEducationFieldEntity>();
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<RoleEntity> Roles => Set<RoleEntity>();
    public DbSet<OfficerEntity> Officers => Set<OfficerEntity>();
    public DbSet<AdminRecordEntity> AdminRecords => Set<AdminRecordEntity>();
    public DbSet<ExamQuestionEntity> ExamQuestions => Set<ExamQuestionEntity>();
    public DbSet<ExamQuestionOptionEntity> ExamQuestionOptions => Set<ExamQuestionOptionEntity>();
    public DbSet<ExamQuestionMatchingPairEntity> ExamQuestionMatchingPairs => Set<ExamQuestionMatchingPairEntity>();
    public DbSet<ExamEntity> Exams => Set<ExamEntity>();
    public DbSet<ExamRuleEntity> ExamRules => Set<ExamRuleEntity>();
    public DbSet<ExamQuestionLinkEntity> ExamQuestionLinks => Set<ExamQuestionLinkEntity>();
    public DbSet<ExamAssignmentEntity> ExamAssignments => Set<ExamAssignmentEntity>();
    public DbSet<ApplicantPortalRecordEntity> ApplicantPortalRecords => Set<ApplicantPortalRecordEntity>();
    public DbSet<ExamSlotEntity> ExamSlots => Set<ExamSlotEntity>();
    public DbSet<AcquaintanceDocSettingsEntity> AcquaintanceDocSettings => Set<AcquaintanceDocSettingsEntity>();
    public DbSet<ApplicantAcquaintanceDocEntity> ApplicantAcquaintanceDocs => Set<ApplicantAcquaintanceDocEntity>();
    public DbSet<ApplicantAcquaintanceDocSectionEntity> ApplicantAcquaintanceDocSections => Set<ApplicantAcquaintanceDocSectionEntity>();
    public DbSet<ApplicantAcquaintanceDocRevisionEntity> ApplicantAcquaintanceDocRevisions => Set<ApplicantAcquaintanceDocRevisionEntity>();
    public DbSet<BarcodeSequenceEntity> BarcodeSequences => Set<BarcodeSequenceEntity>();
    public DbSet<GeneralSettingsEntity> GeneralSettings => Set<GeneralSettingsEntity>();
    public DbSet<PaymentRecordEntity> PaymentRecords => Set<PaymentRecordEntity>();
    public DbSet<ApplicantManagementRecordEntity> ApplicantManagementRecords => Set<ApplicantManagementRecordEntity>();
    public DbSet<GradeOperationalRecordEntity> GradeOperationalRecords => Set<GradeOperationalRecordEntity>();
    public DbSet<NotificationRecordEntity> NotificationRecords => Set<NotificationRecordEntity>();
    public DbSet<WorkflowRecordEntity> WorkflowRecords => Set<WorkflowRecordEntity>();
    public DbSet<CommitteeRecordEntity> CommitteeRecords => Set<CommitteeRecordEntity>();
    public DbSet<ExamOperationalRecordEntity> ExamOperationalRecords => Set<ExamOperationalRecordEntity>();
    public DbSet<BiometricRecordEntity> BiometricRecords => Set<BiometricRecordEntity>();
    public DbSet<AdmissionSetupRecordEntity> AdmissionSetupRecords => Set<AdmissionSetupRecordEntity>();
    public DbSet<ReportSnapshotRecordEntity> ReportSnapshotRecords => Set<ReportSnapshotRecordEntity>();
    public DbSet<CommitteeInstanceEntity> CommitteeInstances => Set<CommitteeInstanceEntity>();
    public DbSet<PaymentLedgerEntity> PaymentLedger => Set<PaymentLedgerEntity>();
    public DbSet<ExamCommitteeUserEntity> ExamCommitteeUsers => Set<ExamCommitteeUserEntity>();
    public DbSet<ExamDeviceEntity> ExamDevices => Set<ExamDeviceEntity>();
    public DbSet<ExamResultEntity> ExamResults => Set<ExamResultEntity>();
    public DbSet<ExamAttemptResultEntity> ExamAttemptResults => Set<ExamAttemptResultEntity>();
    public DbSet<BiometricEnrollmentEntity> BiometricEnrollments => Set<BiometricEnrollmentEntity>();
    public DbSet<NotificationMasterEntity> NotificationsMaster => Set<NotificationMasterEntity>();
    public DbSet<NotificationAudienceEntity> NotificationAudience => Set<NotificationAudienceEntity>();
    public DbSet<ExamPlanEntity> ExamPlans => Set<ExamPlanEntity>();
    public DbSet<ExamPlanExamEntity> ExamPlanExams => Set<ExamPlanExamEntity>();
    public DbSet<CommitteeResultEntity> CommitteeResults => Set<CommitteeResultEntity>();
    public DbSet<CommitteeResultScoreEntity> CommitteeResultScores => Set<CommitteeResultScoreEntity>();
    public DbSet<WorkflowEntity> Workflows => Set<WorkflowEntity>();
    public DbSet<WorkflowStageEntity> WorkflowStages => Set<WorkflowStageEntity>();
    public DbSet<WorkflowStageTestEntity> WorkflowStageTests => Set<WorkflowStageTestEntity>();
    public DbSet<ApplicantWorkflowProgressEntity> ApplicantWorkflowProgress => Set<ApplicantWorkflowProgressEntity>();
    public DbSet<ApplicantWorkflowTestResultEntity> ApplicantWorkflowTestResults => Set<ApplicantWorkflowTestResultEntity>();
    public DbSet<CommitteeMasterEntity> CommitteesMaster => Set<CommitteeMasterEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<LookupRowEntity>(entity =>
        {
            entity.ToTable("lookup_rows");
            entity.HasKey(x => new { x.LookupKey, x.Code });
            entity.Property(x => x.LookupKey).HasColumnName("lookup_key").HasMaxLength(96).IsRequired();
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(96).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(512).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.LookupKey).HasDatabaseName("ix_lookup_rows_lookup_key");
        });

        modelBuilder.Entity<AuditRowEntity>(entity =>
        {
            entity.ToTable("audit_entries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(96);
            entity.Property(x => x.Action).HasColumnName("action").HasMaxLength(96);
            entity.Property(x => x.Entity).HasColumnName("entity").HasMaxLength(128);
            entity.Property(x => x.EntityId).HasColumnName("entity_id").HasMaxLength(128);
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id").HasMaxLength(128);
            entity.Property(x => x.ActorName).HasColumnName("actor_name").HasMaxLength(256);
            entity.Property(x => x.Details).HasColumnName("details");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<AdmissionCycleEntity>(entity =>
        {
            entity.ToTable("admission_cycles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.NameAr).HasColumnName("name_ar").HasMaxLength(256);
            entity.Property(x => x.Year).HasColumnName("year");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.IsActive)
                .IsUnique()
                .HasFilter("[is_active] = CAST(1 AS bit)")
                .HasDatabaseName("ux_admission_cycles_single_active");
        });

        modelBuilder.Entity<ApplicantCategoryEntity>(entity =>
        {
            entity.ToTable("applicant_categories");
            entity.HasKey(x => x.Key);
            entity.Property(x => x.Key).HasColumnName("key").HasMaxLength(96);
            entity.Property(x => x.LabelAr).HasColumnName("label_ar").HasMaxLength(256);
            entity.Property(x => x.IsOpen).HasColumnName("is_open");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<AdmissionRuleEntity>(entity =>
        {
            entity.ToTable("admission_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.Version }).IsUnique().HasDatabaseName("ux_admission_rules_cycle_version");
        });

        modelBuilder.Entity<CommitteeInstanceEntity>(entity =>
        {
            entity.ToTable("committee_instances");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.DefinitionCode).HasColumnName("definition_code").HasMaxLength(96);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CategoryKey).HasColumnName("category_key").HasMaxLength(96);
            entity.Property(x => x.Date).HasColumnName("date");
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.Reserved).HasColumnName("reserved");
            entity.Property(x => x.ReservedRefreshedAt).HasColumnName("reserved_refreshed_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CycleId).HasDatabaseName("ix_committee_instances_cycle_id");
            entity.HasIndex(x => x.CategoryKey).HasDatabaseName("ix_committee_instances_category_key");
            entity.HasIndex(x => x.DefinitionCode).HasDatabaseName("ix_committee_instances_definition_code");
            entity.HasIndex(x => new { x.CycleId, x.Date }).HasDatabaseName("ix_committee_instances_cycle_date");
        });

        modelBuilder.Entity<PaymentLedgerEntity>(entity =>
        {
            entity.ToTable("payment_ledger");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantName).HasColumnName("applicant_name").HasMaxLength(256);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.FawryReference).HasColumnName("fawry_reference").HasMaxLength(128);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(10, 2);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.LastSyncAt).HasColumnName("last_sync_at");
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by").HasMaxLength(128);
            entity.Property(x => x.DeleteReason).HasColumnName("delete_reason").HasMaxLength(512);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.FawryReference)
                .IsUnique()
                .HasFilter("[fawry_reference] IS NOT NULL")
                .HasDatabaseName("ux_payment_ledger_fawry_reference");
            entity.HasIndex(x => x.NationalId).HasDatabaseName("ix_payment_ledger_national_id");
            entity.HasIndex(x => x.CycleId).HasDatabaseName("ix_payment_ledger_cycle_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_payment_ledger_status");
        });

        modelBuilder.Entity<ExamCommitteeUserEntity>(entity =>
        {
            entity.ToTable("exam_committee_users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(256);
            entity.Property(x => x.Username).HasColumnName("username").HasMaxLength(128);
            entity.Property(x => x.Permission).HasColumnName("permission").HasMaxLength(64);
            entity.Property(x => x.ExamType).HasColumnName("exam_type").HasMaxLength(96);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.AuthorizedDeviceId).HasColumnName("authorized_device_id").HasMaxLength(96);
            entity.Property(x => x.AuthorizedIp).HasColumnName("authorized_ip").HasMaxLength(64);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Username).HasDatabaseName("ix_exam_committee_users_username");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exam_committee_users_status");
        });

        modelBuilder.Entity<ExamDeviceEntity>(entity =>
        {
            entity.ToTable("exam_devices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(256);
            entity.Property(x => x.MacAddress).HasColumnName("mac_address").HasMaxLength(64);
            entity.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.AllowedFrom).HasColumnName("allowed_from").HasMaxLength(64);
            entity.Property(x => x.AllowedTo).HasColumnName("allowed_to").HasMaxLength(64);
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.MacAddress).HasDatabaseName("ix_exam_devices_mac_address");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exam_devices_status");
        });

        modelBuilder.Entity<ExamResultEntity>(entity =>
        {
            entity.ToTable("exam_results");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.ReceivedAt).HasColumnName("received_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.ExamId }).HasDatabaseName("ix_exam_results_cycle_exam");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_exam_results_applicant_id");
            entity.HasIndex(x => x.NationalId).HasDatabaseName("ix_exam_results_national_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exam_results_status");
        });

        modelBuilder.Entity<ExamAttemptResultEntity>(entity =>
        {
            entity.ToTable("exam_attempt_results");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.AttemptId).HasColumnName("attempt_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.PassFail).HasColumnName("pass_fail").HasMaxLength(24);
            entity.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ExamId).HasDatabaseName("ix_exam_attempt_results_exam_id");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_exam_attempt_results_applicant_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exam_attempt_results_status");
        });

        modelBuilder.Entity<BiometricEnrollmentEntity>(entity =>
        {
            entity.ToTable("biometric_enrollments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.EnrolledAt).HasColumnName("enrolled_at");
            entity.Property(x => x.EnrolledBy).HasColumnName("enrolled_by").HasMaxLength(128);
            entity.Property(x => x.DeviceEmpCode).HasColumnName("device_emp_code").HasMaxLength(64);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_biometric_enrollments_applicant_id");
            entity.HasIndex(x => x.NationalId).HasDatabaseName("ix_biometric_enrollments_national_id");
            entity.HasIndex(x => x.DeviceEmpCode).HasDatabaseName("ix_biometric_enrollments_device_emp_code");
        });

        modelBuilder.Entity<NotificationMasterEntity>(entity =>
        {
            entity.ToTable("notifications_master");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(48);
            entity.Property(x => x.TitleAr).HasColumnName("title_ar").HasMaxLength(512);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.PublishAt).HasColumnName("publish_at");
            entity.Property(x => x.ExpireAt).HasColumnName("expire_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by").HasMaxLength(128);
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_notifications_master_status");
            entity.HasIndex(x => x.PublishAt).HasDatabaseName("ix_notifications_master_publish_at");
        });

        modelBuilder.Entity<NotificationAudienceEntity>(entity =>
        {
            entity.ToTable("notification_audience");
            entity.HasKey(x => new { x.NotificationId, x.AudienceOrder });
            entity.Property(x => x.NotificationId).HasColumnName("notification_id").HasMaxLength(96);
            entity.Property(x => x.AudienceOrder).HasColumnName("audience_order");
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(48);
            entity.Property(x => x.TargetJson).HasColumnName("target_json");
            entity.HasOne<NotificationMasterEntity>()
                .WithMany(x => x.Audience)
                .HasForeignKey(x => x.NotificationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.Kind).HasDatabaseName("ix_notification_audience_kind");
        });

        modelBuilder.Entity<ExamPlanEntity>(entity =>
        {
            entity.ToTable("exam_plans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CategoryId).HasColumnName("category_id").HasMaxLength(96);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.CategoryId }).HasDatabaseName("ix_exam_plans_cycle_category");
        });

        modelBuilder.Entity<ExamPlanExamEntity>(entity =>
        {
            entity.ToTable("exam_plan_exams");
            entity.HasKey(x => new { x.PlanId, x.ExamOrder });
            entity.Property(x => x.PlanId).HasColumnName("plan_id").HasMaxLength(128);
            entity.Property(x => x.ExamOrder).HasColumnName("exam_order");
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.Fee).HasColumnName("fee").HasPrecision(10, 2);
            entity.Property(x => x.IsRequired).HasColumnName("is_required");
            entity.HasOne<ExamPlanEntity>()
                .WithMany(x => x.Exams)
                .HasForeignKey(x => x.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.ExamId).HasDatabaseName("ix_exam_plan_exams_exam_id");
        });

        modelBuilder.Entity<CommitteeResultEntity>(entity =>
        {
            entity.ToTable("committee_results");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.CommitteeId).HasColumnName("committee_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.Phase).HasColumnName("phase").HasMaxLength(64);
            entity.Property(x => x.PassFail).HasColumnName("pass_fail").HasMaxLength(24);
            entity.Property(x => x.EnteredBy).HasColumnName("entered_by").HasMaxLength(128);
            entity.Property(x => x.EnteredAt).HasColumnName("entered_at");
            entity.Property(x => x.ApprovedBy).HasColumnName("approved_by").HasMaxLength(128);
            entity.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CommitteeId).HasDatabaseName("ix_committee_results_committee_id");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_committee_results_applicant_id");
            entity.HasIndex(x => x.Phase).HasDatabaseName("ix_committee_results_phase");
        });

        modelBuilder.Entity<CommitteeResultScoreEntity>(entity =>
        {
            entity.ToTable("committee_result_scores");
            entity.HasKey(x => new { x.ResultId, x.ScoreKey });
            entity.Property(x => x.ResultId).HasColumnName("result_id").HasMaxLength(128);
            entity.Property(x => x.ScoreKey).HasColumnName("score_key").HasMaxLength(96);
            entity.Property(x => x.ScoreValue).HasColumnName("score_value").HasPrecision(10, 2);
            entity.HasOne<CommitteeResultEntity>()
                .WithMany(x => x.Scores)
                .HasForeignKey(x => x.ResultId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkflowEntity>(entity =>
        {
            entity.ToTable("workflows");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Department).HasColumnName("department").HasMaxLength(48);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(256);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.UpdatedBy).HasColumnName("updated_by").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Department).HasDatabaseName("ix_workflows_department");
            entity.HasIndex(x => x.CycleId).HasDatabaseName("ix_workflows_cycle_id");
            entity.HasIndex(x => x.IsActive).HasDatabaseName("ix_workflows_is_active");
        });

        modelBuilder.Entity<WorkflowStageEntity>(entity =>
        {
            entity.ToTable("workflow_stages");
            entity.HasKey(x => new { x.WorkflowId, x.StageOrder });
            entity.Property(x => x.WorkflowId).HasColumnName("workflow_id").HasMaxLength(96);
            entity.Property(x => x.StageOrder).HasColumnName("stage_order");
            entity.Property(x => x.StageId).HasColumnName("stage_id").HasMaxLength(96);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(256);
            entity.Property(x => x.StatusOnEnter).HasColumnName("status_on_enter").HasMaxLength(64);
            entity.Property(x => x.AllowedNextStatusesJson).HasColumnName("allowed_next_statuses_json");
            entity.HasOne<WorkflowEntity>()
                .WithMany(x => x.Stages)
                .HasForeignKey(x => x.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.StageId).HasDatabaseName("ix_workflow_stages_stage_id");
        });

        modelBuilder.Entity<WorkflowStageTestEntity>(entity =>
        {
            entity.ToTable("workflow_stage_tests");
            entity.HasKey(x => new { x.WorkflowId, x.StageId, x.TestOrder });
            entity.Property(x => x.WorkflowId).HasColumnName("workflow_id").HasMaxLength(96);
            entity.Property(x => x.StageId).HasColumnName("stage_id").HasMaxLength(96);
            entity.Property(x => x.TestOrder).HasColumnName("test_order");
            entity.Property(x => x.TestId).HasColumnName("test_id").HasMaxLength(96);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(256);
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(32);
            entity.Property(x => x.Required).HasColumnName("required");
            entity.Property(x => x.PassCriterionJson).HasColumnName("pass_criterion_json");
            entity.Property(x => x.OwnerApp).HasColumnName("owner_app").HasMaxLength(48);
            entity.HasOne<WorkflowEntity>()
                .WithMany(x => x.Tests)
                .HasForeignKey(x => x.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicantWorkflowProgressEntity>(entity =>
        {
            entity.ToTable("applicant_workflow_progress");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.WorkflowId).HasColumnName("workflow_id").HasMaxLength(96);
            entity.Property(x => x.WorkflowVersion).HasColumnName("workflow_version");
            entity.Property(x => x.CurrentStageId).HasColumnName("current_stage_id").HasMaxLength(96);
            entity.Property(x => x.CompletedStageIdsJson).HasColumnName("completed_stage_ids_json");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_applicant_workflow_progress_applicant_id");
            entity.HasIndex(x => x.WorkflowId).HasDatabaseName("ix_applicant_workflow_progress_workflow_id");
        });

        modelBuilder.Entity<ApplicantWorkflowTestResultEntity>(entity =>
        {
            entity.ToTable("applicant_workflow_test_results");
            entity.HasKey(x => new { x.ProgressId, x.StageId, x.TestId });
            entity.Property(x => x.ProgressId).HasColumnName("progress_id").HasMaxLength(128);
            entity.Property(x => x.StageId).HasColumnName("stage_id").HasMaxLength(96);
            entity.Property(x => x.TestId).HasColumnName("test_id").HasMaxLength(96);
            entity.Property(x => x.Outcome).HasColumnName("outcome").HasMaxLength(48);
            entity.Property(x => x.Score).HasColumnName("score").HasPrecision(10, 2);
            entity.Property(x => x.RecordedAt).HasColumnName("recorded_at");
            entity.Property(x => x.RecordedBy).HasColumnName("recorded_by").HasMaxLength(128);
            entity.HasOne<ApplicantWorkflowProgressEntity>()
                .WithMany(x => x.TestResults)
                .HasForeignKey(x => x.ProgressId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CommitteeMasterEntity>(entity =>
        {
            entity.ToTable("committees");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(256);
            entity.Property(x => x.CategoryKey).HasColumnName("category_key").HasMaxLength(96);
            entity.Property(x => x.GradeType).HasColumnName("grade_type").HasMaxLength(48);
            entity.Property(x => x.GradeMin).HasColumnName("grade_min").HasPrecision(7, 2);
            entity.Property(x => x.GradeMax).HasColumnName("grade_max").HasPrecision(7, 2);
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(24);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.HeadUserId).HasColumnName("head_user_id").HasMaxLength(128);
            entity.Property(x => x.AcademicYearId).HasColumnName("academic_year_id").HasMaxLength(96);
            entity.Property(x => x.LinkedCycleId).HasColumnName("linked_cycle_id").HasMaxLength(96);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CategoryKey).HasDatabaseName("ix_committees_category_key");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_committees_status");
            entity.HasIndex(x => x.LinkedCycleId).HasDatabaseName("ix_committees_linked_cycle_id");
        });

        modelBuilder.Entity<ApplicationSettingsCategoryConfigEntity>(entity =>
        {
            entity.ToTable("application_settings_category_configs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CategoryId).HasColumnName("category_id").HasMaxLength(96);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CategoryId).IsUnique().HasDatabaseName("ux_app_settings_configs_category_id");
            entity.HasIndex(x => x.SortOrder).HasDatabaseName("ix_app_settings_configs_sort_order");
        });

        modelBuilder.Entity<ApplicationSettingsCategorySpecializationEntity>(entity =>
        {
            entity.ToTable("application_settings_category_specializations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.ConfigId).HasColumnName("config_id").HasMaxLength(96);
            entity.Property(x => x.SpecializationId).HasColumnName("specialization_id").HasMaxLength(96);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ConfigId).HasDatabaseName("ix_app_settings_specs_config_id");
            entity.HasIndex(x => new { x.ConfigId, x.SpecializationId }).IsUnique().HasDatabaseName("ux_app_settings_specs_config_specialization");
        });

        modelBuilder.Entity<ApplicationSettingsGraduationYearEntity>(entity =>
        {
            entity.ToTable("application_settings_graduation_years");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CategorySpecializationId).HasColumnName("category_specialization_id").HasMaxLength(96);
            entity.Property(x => x.GraduationYearsJson).HasColumnName("graduation_years_json");
            entity.Property(x => x.GenderTypesJson).HasColumnName("gender_types_json");
            entity.Property(x => x.MaritalStatusCodesJson).HasColumnName("marital_status_codes_json");
            entity.Property(x => x.AgeMin).HasColumnName("age_min");
            entity.Property(x => x.MaxAge).HasColumnName("max_age");
            entity.Property(x => x.DivisionCodesJson).HasColumnName("division_codes_json");
            entity.Property(x => x.SchoolCategoryCodesJson).HasColumnName("school_category_codes_json");
            entity.Property(x => x.ApplicationStartDate).HasColumnName("application_start_date");
            entity.Property(x => x.ApplicationEndDate).HasColumnName("application_end_date");
            entity.Property(x => x.AgeReferenceDate).HasColumnName("age_reference_date");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.GradeKind).HasColumnName("grade_kind").HasMaxLength(16);
            entity.Property(x => x.MinPercentage).HasColumnName("min_percentage").HasPrecision(5, 2);
            entity.Property(x => x.AcademicGradeId).HasColumnName("academic_grade_id").HasMaxLength(96);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CategorySpecializationId).HasDatabaseName("ix_app_settings_years_category_specialization_id");
            entity.HasIndex(x => new { x.CategorySpecializationId, x.ApplicationStartDate, x.ApplicationEndDate }).HasDatabaseName("ix_app_settings_years_window");
        });

        modelBuilder.Entity<CategoryEducationFieldEntity>(entity =>
        {
            entity.ToTable("category_education_fields");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CategoryKey).HasColumnName("category_key").HasMaxLength(96);
            entity.Property(x => x.FieldKey).HasColumnName("field_key").HasMaxLength(96);
            entity.Property(x => x.LabelAr).HasColumnName("label_ar").HasMaxLength(256);
            entity.Property(x => x.InputKind).HasColumnName("input_kind").HasMaxLength(32);
            entity.Property(x => x.SectionKey).HasColumnName("section_key").HasMaxLength(32);
            entity.Property(x => x.IsRequired).HasColumnName("is_required");
            entity.Property(x => x.MinValue).HasColumnName("min_value").HasPrecision(9, 2);
            entity.Property(x => x.MaxValue).HasColumnName("max_value").HasPrecision(9, 2);
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CategoryKey, x.SortOrder }).HasDatabaseName("ix_category_education_fields_category_sort");
            entity.HasIndex(x => new { x.CategoryKey, x.FieldKey }).IsUnique().HasDatabaseName("ux_category_education_fields_category_field");
        });

        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.FullArabicName).HasColumnName("full_arabic_name").HasMaxLength(256);
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(96);
            entity.Property(x => x.AccountStatus).HasColumnName("account_status").HasMaxLength(48);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.NationalId).IsUnique().HasDatabaseName("ux_users_national_id");
        });

        modelBuilder.Entity<RoleEntity>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.Key).HasColumnName("key").HasMaxLength(96);
            entity.Property(x => x.LabelAr).HasColumnName("label_ar").HasMaxLength(256);
            entity.Property(x => x.IsSystem).HasColumnName("is_system");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Key).IsUnique().HasDatabaseName("ux_roles_key");
        });

        modelBuilder.Entity<OfficerEntity>(entity =>
        {
            entity.ToTable("officer_directory");
            entity.HasKey(x => x.NationalId);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.FullArabicName).HasColumnName("full_arabic_name").HasMaxLength(256);
            entity.Property(x => x.OfficerCode).HasColumnName("officer_code").HasMaxLength(64);
            entity.Property(x => x.MobileNumber).HasColumnName("mobile_number").HasMaxLength(32);
            entity.Property(x => x.UserType).HasColumnName("user_type").HasMaxLength(64);
        });

        modelBuilder.Entity<AdminRecordEntity>(entity =>
        {
            entity.ToTable("admin_records");
            entity.HasKey(x => new { x.Module, x.Id });
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(96);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Module).HasDatabaseName("ix_admin_records_module");
        });

        ConfigureOperationalRecord<PaymentRecordEntity>(modelBuilder, "payments");
        ConfigureOperationalRecord<ApplicantManagementRecordEntity>(modelBuilder, "applicant_management_records");
        ConfigureOperationalRecord<GradeOperationalRecordEntity>(modelBuilder, "grade_operational_records");
        ConfigureOperationalRecord<NotificationRecordEntity>(modelBuilder, "notifications");
        ConfigureOperationalRecord<WorkflowRecordEntity>(modelBuilder, "workflow_records");
        ConfigureOperationalRecord<CommitteeRecordEntity>(modelBuilder, "committee_records");
        ConfigureOperationalRecord<ExamOperationalRecordEntity>(modelBuilder, "exam_operational_records");
        ConfigureOperationalRecord<BiometricRecordEntity>(modelBuilder, "biometric_records");
        ConfigureOperationalRecord<AdmissionSetupRecordEntity>(modelBuilder, "admission_setup_records");
        ConfigureOperationalRecord<ReportSnapshotRecordEntity>(modelBuilder, "report_snapshots");

        modelBuilder.Entity<ExamQuestionEntity>(entity =>
        {
            entity.ToTable("exam_questions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(128);
            entity.Property(x => x.Classification).HasColumnName("classification").HasMaxLength(128);
            entity.Property(x => x.Difficulty).HasColumnName("difficulty");
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(48);
            entity.Property(x => x.Text).HasColumnName("text");
            entity.Property(x => x.CorrectIndex).HasColumnName("correct_index");
            entity.Property(x => x.TimeLimitSeconds).HasColumnName("time_limit_seconds");
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.ImageUrl).HasColumnName("image_url").HasMaxLength(1024);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Category).HasDatabaseName("ix_exam_questions_category");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exam_questions_status");
        });

        modelBuilder.Entity<ExamQuestionOptionEntity>(entity =>
        {
            entity.ToTable("exam_question_options");
            entity.HasKey(x => new { x.QuestionId, x.OptionOrder });
            entity.Property(x => x.QuestionId).HasColumnName("question_id").HasMaxLength(128);
            entity.Property(x => x.OptionOrder).HasColumnName("option_order");
            entity.Property(x => x.OptionText).HasColumnName("option_text");
            entity.HasOne<ExamQuestionEntity>()
                .WithMany(x => x.Options)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExamQuestionMatchingPairEntity>(entity =>
        {
            entity.ToTable("exam_question_matching_pairs");
            entity.HasKey(x => new { x.QuestionId, x.PairOrder });
            entity.Property(x => x.QuestionId).HasColumnName("question_id").HasMaxLength(128);
            entity.Property(x => x.PairOrder).HasColumnName("pair_order");
            entity.Property(x => x.Prompt).HasColumnName("prompt");
            entity.Property(x => x.MatchText).HasColumnName("match_text");
            entity.HasOne<ExamQuestionEntity>()
                .WithMany(x => x.MatchingPairs)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExamEntity>(entity =>
        {
            entity.ToTable("exams");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.NameAr).HasColumnName("name_ar").HasMaxLength(256);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CycleName).HasColumnName("cycle_name").HasMaxLength(256);
            entity.Property(x => x.ScheduledFor).HasColumnName("scheduled_for").HasMaxLength(64);
            entity.Property(x => x.AccessStartAt).HasColumnName("access_start_at").HasMaxLength(64);
            entity.Property(x => x.AccessEndAt).HasColumnName("access_end_at").HasMaxLength(64);
            entity.Property(x => x.DurationMinutes).HasColumnName("duration_minutes");
            entity.Property(x => x.QuestionCount).HasColumnName("question_count");
            entity.Property(x => x.RandomSelection).HasColumnName("random_selection");
            entity.Property(x => x.RandomQuestionOrder).HasColumnName("random_question_order");
            entity.Property(x => x.DisplayMode).HasColumnName("display_mode").HasMaxLength(48);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(48);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CycleId).HasDatabaseName("ix_exams_cycle_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_exams_status");
        });

        modelBuilder.Entity<ExamRuleEntity>(entity =>
        {
            entity.ToTable("exam_rules");
            entity.HasKey(x => new { x.ExamId, x.RuleOrder });
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.RuleOrder).HasColumnName("rule_order");
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(128);
            entity.Property(x => x.DifficultyMin).HasColumnName("difficulty_min");
            entity.Property(x => x.DifficultyMax).HasColumnName("difficulty_max");
            entity.Property(x => x.QuestionCount).HasColumnName("question_count");
            entity.Property(x => x.Minutes).HasColumnName("minutes");
            entity.HasOne<ExamEntity>()
                .WithMany(x => x.Rules)
                .HasForeignKey(x => x.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExamQuestionLinkEntity>(entity =>
        {
            entity.ToTable("exam_question_links");
            entity.HasKey(x => new { x.ExamId, x.QuestionOrder });
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.QuestionOrder).HasColumnName("question_order");
            entity.Property(x => x.QuestionId).HasColumnName("question_id").HasMaxLength(128);
            entity.HasIndex(x => x.QuestionId).HasDatabaseName("ix_exam_question_links_question_id");
            entity.HasOne<ExamEntity>()
                .WithMany(x => x.QuestionLinks)
                .HasForeignKey(x => x.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExamAssignmentEntity>(entity =>
        {
            entity.ToTable("exam_assignments");
            entity.HasKey(x => new { x.ExamId, x.AssignmentKind, x.AssignmentOrder });
            entity.Property(x => x.ExamId).HasColumnName("exam_id").HasMaxLength(128);
            entity.Property(x => x.AssignmentKind).HasColumnName("assignment_kind").HasMaxLength(64);
            entity.Property(x => x.AssignmentOrder).HasColumnName("assignment_order");
            entity.Property(x => x.Value).HasColumnName("value").HasMaxLength(256);
            entity.HasOne<ExamEntity>()
                .WithMany(x => x.Assignments)
                .HasForeignKey(x => x.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicantPortalRecordEntity>(entity =>
        {
            entity.ToTable("applicant_portal_records");
            entity.HasKey(x => new { x.Type, x.RecordId });
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(64);
            entity.Property(x => x.RecordId).HasColumnName("record_id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_portal_records_applicant_id");
        });

        modelBuilder.Entity<ExamSlotEntity>(entity =>
        {
            entity.ToTable("exam_slots");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(64);
            entity.Property(x => x.Date).HasColumnName("date");
            entity.Property(x => x.Time).HasColumnName("time").HasMaxLength(16);
            entity.Property(x => x.Location).HasColumnName("location").HasMaxLength(512);
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.Reserved).HasColumnName("reserved");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Date).HasDatabaseName("ix_exam_slots_date");
        });

        modelBuilder.Entity<AcquaintanceDocSettingsEntity>(entity =>
        {
            entity.ToTable("acquaintance_doc_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.OpeningTestKey).HasColumnName("opening_test_key").HasMaxLength(96);
            entity.Property(x => x.OpeningRequiredOutcome).HasColumnName("opening_required_outcome").HasMaxLength(32);
            entity.Property(x => x.ClosingTestKey).HasColumnName("closing_test_key").HasMaxLength(96);
            entity.Property(x => x.ClosingMode).HasColumnName("closing_mode").HasMaxLength(48);
            entity.Property(x => x.ClosingAt).HasColumnName("closing_at");
            entity.Property(x => x.IsEnabled).HasColumnName("is_enabled");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.CycleId).IsUnique().HasDatabaseName("ux_acquaintance_doc_settings_cycle_id");
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_docs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(32);
            entity.Property(x => x.OpenedAt).HasColumnName("opened_at");
            entity.Property(x => x.ClosedAt).HasColumnName("closed_at");
            entity.Property(x => x.LastAutosavedAt).HasColumnName("last_autosaved_at");
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.CycleId, x.ApplicantId }).IsUnique().HasDatabaseName("ux_applicant_acquaintance_docs_cycle_applicant");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName("ix_applicant_acquaintance_docs_applicant_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("ix_applicant_acquaintance_docs_status");
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocSectionEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_doc_sections");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocId).HasColumnName("acquaintance_doc_id").HasMaxLength(96);
            entity.Property(x => x.SectionKey).HasColumnName("section_key").HasMaxLength(64);
            entity.Property(x => x.DataJson).HasColumnName("data_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => new { x.AcquaintanceDocId, x.SectionKey }).IsUnique().HasDatabaseName("ux_applicant_acquaintance_doc_sections_doc_section");
            entity.HasOne<ApplicantAcquaintanceDocEntity>()
                .WithMany(x => x.Sections)
                .HasForeignKey(x => x.AcquaintanceDocId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicantAcquaintanceDocRevisionEntity>(entity =>
        {
            entity.ToTable("applicant_acquaintance_doc_revisions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocId).HasColumnName("acquaintance_doc_id").HasMaxLength(96);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.ChangeKind).HasColumnName("change_kind").HasMaxLength(32);
            entity.Property(x => x.ChangedSectionKeysJson).HasColumnName("changed_section_keys_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.AcquaintanceDocId).HasDatabaseName("ix_applicant_acquaintance_doc_revisions_doc_id");
            entity.HasOne<ApplicantAcquaintanceDocEntity>()
                .WithMany()
                .HasForeignKey(x => x.AcquaintanceDocId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BarcodeSequenceEntity>(entity =>
        {
            entity.ToTable("barcode_sequences");
            entity.HasKey(x => new { x.CycleId, x.CommitteeCode });
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CommitteeCode).HasColumnName("committee_code").HasMaxLength(96);
            entity.Property(x => x.NextSequence).HasColumnName("next_sequence");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        modelBuilder.Entity<GeneralSettingsEntity>(entity =>
        {
            entity.ToTable("general_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(64);
            entity.Property(x => x.ExamDaysPerApplicant).HasColumnName("exam_days_per_applicant");
            entity.Property(x => x.ExamSlotSelectionWindowDays).HasColumnName("exam_slot_selection_window_days");
            entity.Property(x => x.PrimaryRelativesEntryResponsibleTestCode).HasColumnName("primary_relatives_entry_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsEntryResponsibleTestCode).HasColumnName("acquaintance_documents_entry_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsPrintResponsibleTestCode).HasColumnName("acquaintance_documents_print_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsMutationLockTiming).HasColumnName("acquaintance_documents_mutation_lock_timing").HasMaxLength(48);
            entity.Property(x => x.AcquaintanceDocumentsOpenTiming).HasColumnName("acquaintance_documents_open_timing").HasMaxLength(48);
            entity.Property(x => x.AcquaintanceDocumentsOpenOffsetValue).HasColumnName("acquaintance_documents_open_offset_value");
            entity.Property(x => x.AcquaintanceDocumentsOpenOffsetUnit).HasColumnName("acquaintance_documents_open_offset_unit").HasMaxLength(16);
            entity.Property(x => x.AcquaintanceDocumentsCloseResponsibleTestCode).HasColumnName("acquaintance_documents_close_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.AcquaintanceDocumentsCloseTiming).HasColumnName("acquaintance_documents_close_timing").HasMaxLength(48);
            entity.Property(x => x.AcquaintanceDocumentsCloseOffsetValue).HasColumnName("acquaintance_documents_close_offset_value");
            entity.Property(x => x.AcquaintanceDocumentsCloseOffsetUnit).HasColumnName("acquaintance_documents_close_offset_unit").HasMaxLength(16);
            entity.Property(x => x.PrimaryRelativesVisibilityResponsibleTestCode).HasColumnName("primary_relatives_visibility_responsible_test_code").HasMaxLength(96);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
        });

        // Data-Exchange change-tracking columns — mapped uniformly on every
        // IChangeTracked entity (the 8 exchangeable domains). created_at/updated_at/
        // row_version already exist per-entity above; these three are additive.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(IChangeTracked).IsAssignableFrom(entityType.ClrType)) continue;

            var b = modelBuilder.Entity(entityType.ClrType);
            b.Property(nameof(IChangeTracked.LastModifiedBy))
                .HasColumnName(ChangeTrackingColumns.LastModifiedBy).HasMaxLength(128);
            // NOT NULL with a DB default. The CLR property is initialized to the
            // same default on every entity, so direct construction never produces
            // null; the interceptor leaves a non-blank value intact (import
            // provenance survives) and the DB default backfills raw inserts.
            b.Property(nameof(IChangeTracked.SourceSystem))
                .HasColumnName(ChangeTrackingColumns.SourceSystem).HasMaxLength(64)
                .HasDefaultValue(ChangeTrackingColumns.DefaultSourceSystem)
                .IsRequired();
            b.Property(nameof(IChangeTracked.Checksum))
                .HasColumnName(ChangeTrackingColumns.Checksum).HasMaxLength(64);
        }
    }

    private static void ConfigureOperationalRecord<TEntity>(ModelBuilder modelBuilder, string tableName)
        where TEntity : OperationalRecordEntity
    {
        modelBuilder.Entity<TEntity>(entity =>
        {
            entity.ToTable(tableName);
            entity.HasKey(x => new { x.Module, x.Id });
            entity.Property(x => x.Module).HasColumnName("module").HasMaxLength(128);
            entity.Property(x => x.Id).HasColumnName("id").HasMaxLength(128);
            entity.Property(x => x.ApplicantId).HasColumnName("applicant_id").HasMaxLength(128);
            entity.Property(x => x.NationalId).HasColumnName("national_id").HasMaxLength(32);
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasMaxLength(96);
            entity.Property(x => x.CommitteeId).HasColumnName("committee_id").HasMaxLength(128);
            entity.Property(x => x.CategoryKey).HasColumnName("category_key").HasMaxLength(128);
            entity.Property(x => x.Department).HasColumnName("department").HasMaxLength(128);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(96);
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(96);
            entity.Property(x => x.OccurredAt).HasColumnName("occurred_at");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
            entity.HasIndex(x => x.Module).HasDatabaseName($"ix_{tableName}_module");
            entity.HasIndex(x => x.ApplicantId).HasDatabaseName($"ix_{tableName}_applicant_id");
            entity.HasIndex(x => x.NationalId).HasDatabaseName($"ix_{tableName}_national_id");
            entity.HasIndex(x => x.CycleId).HasDatabaseName($"ix_{tableName}_cycle_id");
            entity.HasIndex(x => x.Status).HasDatabaseName($"ix_{tableName}_status");
        });
    }
}
