using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Admissions.Infrastructure.Migrations
{
    /// <summary>
    /// Spec 009 — Admission-Setup Wizard Persistence.
    ///
    /// This migration is the FIRST migration on <c>AdmissionsDbContext</c>.
    /// The legacy <c>PaDbContext</c> (spec 002–005) already created cycles,
    /// categories, applicants, admission_rules, and applicant_stage_submissions
    /// tables. Spec 009 adds:
    ///   • 4 new columns on existing tables:
    ///       - cycles.RowVersion         (rowversion, NOT NULL)
    ///       - categories.RowVersion     (rowversion, NOT NULL)
    ///       - admission_rules.RowVersion(rowversion, NOT NULL)
    ///       - applicants.CommitteeId    (uniqueidentifier, NULL)
    ///   • 7 brand-new tables:
    ///       - wizard_step_statuses
    ///       - committee_merge_split_rules
    ///       - committee_score_thresholds
    ///       - exam_date_configs
    ///       - total_score_configs
    ///       - electronic_declarations
    ///       - cycle_exams
    ///
    /// Each new column add and table create is wrapped in IF NOT EXISTS guards so
    /// the migration is idempotent on shared dev/staging DBs that may already
    /// have partial state from earlier `dotnet ef database update` attempts
    /// (the dual-UserManager / per-context history pattern from spec 007).
    /// </summary>
    public partial class _009_AdmissionSetupEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Add RowVersion to existing tables (optimistic locking — FR-012) ──
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.cycles', 'RowVersion') IS NULL
                    ALTER TABLE dbo.cycles ADD RowVersion rowversion NOT NULL;
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.categories', 'RowVersion') IS NULL
                    ALTER TABLE dbo.categories ADD RowVersion rowversion NOT NULL;
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.admission_rules', 'RowVersion') IS NULL
                    ALTER TABLE dbo.admission_rules ADD RowVersion rowversion NOT NULL;
            ");

            // ── 2. Add CommitteeId to applicants (for merge/split apply — FR-024) ──
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.applicants', 'CommitteeId') IS NULL
                    ALTER TABLE dbo.applicants ADD CommitteeId uniqueidentifier NULL;
            ");

            // ── 3. Create 7 new wizard-owned tables ──

            // wizard_step_statuses — per-(cycle, step) completion pill state
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.wizard_step_statuses', 'U') IS NULL
                CREATE TABLE dbo.wizard_step_statuses (
                    CycleId       uniqueidentifier NOT NULL,
                    StepKey       nvarchar(64)     NOT NULL,
                    Status        nvarchar(32)     NOT NULL DEFAULT 'NotStarted',
                    CompletedAt   datetime2        NULL,
                    CompletedBy   uniqueidentifier NULL,
                    UpdatedAt     datetime2        NOT NULL,
                    RowVersion    rowversion       NOT NULL,
                    CONSTRAINT PK_wizard_step_statuses PRIMARY KEY (CycleId, StepKey)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wizard_step_statuses_cycle')
                CREATE INDEX IX_wizard_step_statuses_cycle ON dbo.wizard_step_statuses(CycleId);
            ");

            // committee_merge_split_rules — step 9
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.committee_merge_split_rules', 'U') IS NULL
                CREATE TABLE dbo.committee_merge_split_rules (
                    Id                   uniqueidentifier NOT NULL,
                    CycleId              uniqueidentifier NOT NULL,
                    Type                 nvarchar(16)     NOT NULL,
                    SourceCommitteeIds   nvarchar(max)    NOT NULL DEFAULT '[]',
                    TargetCommitteeIds   nvarchar(max)    NOT NULL DEFAULT '[]',
                    Reason               nvarchar(500)    NULL,
                    EffectiveAt          datetime2        NOT NULL,
                    Status               nvarchar(16)     NOT NULL DEFAULT 'Planned',
                    AppliedAt            datetime2        NULL,
                    AppliedBy            uniqueidentifier NULL,
                    CancelledAt          datetime2        NULL,
                    CancelledBy          uniqueidentifier NULL,
                    CancelReason         nvarchar(500)    NULL,
                    IsArchived           bit              NOT NULL DEFAULT 0,
                    CreatedAt            datetime2        NOT NULL,
                    CreatedBy            uniqueidentifier NOT NULL,
                    UpdatedAt            datetime2        NOT NULL,
                    RowVersion           rowversion       NOT NULL,
                    CONSTRAINT PK_committee_merge_split_rules PRIMARY KEY (Id)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_merge_split_rules_cycle')
                CREATE INDEX IX_merge_split_rules_cycle ON dbo.committee_merge_split_rules(CycleId);
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_merge_split_rules_cycle_status')
                CREATE INDEX IX_merge_split_rules_cycle_status ON dbo.committee_merge_split_rules(CycleId, Status);
            ");

            // committee_score_thresholds — step 10
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.committee_score_thresholds', 'U') IS NULL
                CREATE TABLE dbo.committee_score_thresholds (
                    CycleId      uniqueidentifier NOT NULL,
                    CommitteeId  uniqueidentifier NOT NULL,
                    [Min]        int              NOT NULL,
                    [Max]        int              NOT NULL,
                    UpdatedAt    datetime2        NOT NULL,
                    UpdatedBy    uniqueidentifier NOT NULL,
                    RowVersion   rowversion       NOT NULL,
                    CONSTRAINT PK_committee_score_thresholds PRIMARY KEY (CycleId, CommitteeId)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_score_thresholds_cycle')
                CREATE INDEX IX_score_thresholds_cycle ON dbo.committee_score_thresholds(CycleId);
            ");

            // exam_date_configs — step 11
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.exam_date_configs', 'U') IS NULL
                CREATE TABLE dbo.exam_date_configs (
                    Id                  uniqueidentifier NOT NULL,
                    CycleId             uniqueidentifier NOT NULL,
                    FirstAvailableDate  datetime2        NOT NULL,
                    BookableDays        nvarchar(max)    NOT NULL DEFAULT '[]',
                    BlackoutDates       nvarchar(max)    NOT NULL DEFAULT '[]',
                    UpdatedAt           datetime2        NOT NULL,
                    UpdatedBy           uniqueidentifier NOT NULL,
                    RowVersion          rowversion       NOT NULL,
                    CONSTRAINT PK_exam_date_configs PRIMARY KEY (Id)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_date_configs_cycle')
                CREATE UNIQUE INDEX IX_exam_date_configs_cycle ON dbo.exam_date_configs(CycleId);
            ");

            // total_score_configs — step 13
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.total_score_configs', 'U') IS NULL
                CREATE TABLE dbo.total_score_configs (
                    Id               uniqueidentifier NOT NULL,
                    CycleId          uniqueidentifier NOT NULL,
                    ApplicantStream  nvarchar(32)     NOT NULL,
                    Components       nvarchar(max)    NOT NULL DEFAULT '[]',
                    TotalScoreOutOf  int              NOT NULL,
                    UpdatedAt        datetime2        NOT NULL,
                    UpdatedBy        uniqueidentifier NOT NULL,
                    RowVersion       rowversion       NOT NULL,
                    CONSTRAINT PK_total_score_configs PRIMARY KEY (Id)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_total_score_configs_cycle_stream')
                CREATE UNIQUE INDEX IX_total_score_configs_cycle_stream
                    ON dbo.total_score_configs(CycleId, ApplicantStream);
            ");

            // electronic_declarations — step 15
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.electronic_declarations', 'U') IS NULL
                CREATE TABLE dbo.electronic_declarations (
                    Id              uniqueidentifier NOT NULL,
                    CycleId         uniqueidentifier NOT NULL,
                    BodyAr          nvarchar(max)    COLLATE Arabic_100_CI_AS_SC NOT NULL,
                    Version         int              NOT NULL DEFAULT 1,
                    EffectiveFrom   datetime2        NOT NULL,
                    PublishedAt     datetime2        NULL,
                    IsArchived      bit              NOT NULL DEFAULT 0,
                    CreatedAt       datetime2        NOT NULL,
                    CreatedBy       uniqueidentifier NOT NULL,
                    RowVersion      rowversion       NOT NULL,
                    CONSTRAINT PK_electronic_declarations PRIMARY KEY (Id)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_electronic_declarations_cycle')
                CREATE INDEX IX_electronic_declarations_cycle ON dbo.electronic_declarations(CycleId);
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_electronic_declarations_cycle_version')
                CREATE UNIQUE INDEX IX_electronic_declarations_cycle_version
                    ON dbo.electronic_declarations(CycleId, Version);
            ");

            // cycle_exams — step 7 (US2)
            migrationBuilder.Sql(@"
                IF OBJECT_ID('dbo.cycle_exams', 'U') IS NULL
                CREATE TABLE dbo.cycle_exams (
                    Id           uniqueidentifier NOT NULL,
                    CycleId      uniqueidentifier NOT NULL,
                    ExamTypeKey  nvarchar(100)    NOT NULL,
                    CategoryId   uniqueidentifier NULL,
                    [Order]      int              NOT NULL,
                    IsRequired   bit              NOT NULL DEFAULT 0,
                    FeeEgp       decimal(10,2)    NULL,
                    IsArchived   bit              NOT NULL DEFAULT 0,
                    CreatedAt    datetime2        NOT NULL,
                    CreatedBy    uniqueidentifier NOT NULL,
                    UpdatedAt    datetime2        NOT NULL,
                    RowVersion   rowversion       NOT NULL,
                    CONSTRAINT PK_cycle_exams PRIMARY KEY (Id)
                );
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_cycle_exams_cycle')
                CREATE INDEX IX_cycle_exams_cycle ON dbo.cycle_exams(CycleId);
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_cycle_exams_cycle_order')
                CREATE UNIQUE INDEX IX_cycle_exams_cycle_order
                    ON dbo.cycle_exams(CycleId, [Order])
                    WHERE IsArchived = 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ── Drop the 7 new tables (reverse dependency order) ──
            migrationBuilder.Sql("IF OBJECT_ID('dbo.cycle_exams', 'U') IS NOT NULL DROP TABLE dbo.cycle_exams;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.electronic_declarations', 'U') IS NOT NULL DROP TABLE dbo.electronic_declarations;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.total_score_configs', 'U') IS NOT NULL DROP TABLE dbo.total_score_configs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.exam_date_configs', 'U') IS NOT NULL DROP TABLE dbo.exam_date_configs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.committee_score_thresholds', 'U') IS NOT NULL DROP TABLE dbo.committee_score_thresholds;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.committee_merge_split_rules', 'U') IS NOT NULL DROP TABLE dbo.committee_merge_split_rules;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.wizard_step_statuses', 'U') IS NOT NULL DROP TABLE dbo.wizard_step_statuses;");

            // ── Drop the 4 new columns on existing tables ──
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.applicants', 'CommitteeId') IS NOT NULL
                    ALTER TABLE dbo.applicants DROP COLUMN CommitteeId;
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.admission_rules', 'RowVersion') IS NOT NULL
                    ALTER TABLE dbo.admission_rules DROP COLUMN RowVersion;
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.categories', 'RowVersion') IS NOT NULL
                    ALTER TABLE dbo.categories DROP COLUMN RowVersion;
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.cycles', 'RowVersion') IS NOT NULL
                    ALTER TABLE dbo.cycles DROP COLUMN RowVersion;
            ");
        }
    }
}
