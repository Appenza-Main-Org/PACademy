-- Phase 5: Migration history split — idempotent script.
-- Splits the existing __EFMigrationsHistory into 5 per-context history tables.
-- Run once on any DB that was created before phase 5 (via dotnet ef database update using PaDbContext).
-- On a fresh dev DB, just run each context's migrations directly — this script is not needed.
--
-- Context → table mapping (FR-X01):
--   AuditDbContext         → __EFMigrationsHistory_Audit
--   IdentityDbContext      → __EFMigrationsHistory_Identity
--   ReferenceDataDbContext → __EFMigrationsHistory_ReferenceData
--   WorkflowsDbContext     → __EFMigrationsHistory_Workflows
--   AdmissionsDbContext    → __EFMigrationsHistory_Admissions

BEGIN TRANSACTION;

-- Guard: if split has already been done, skip everything
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__EFMigrationsHistory_Admissions')
BEGIN
    -- Create per-context history tables (same schema as the original)
    CREATE TABLE __EFMigrationsHistory_Audit (
        MigrationId  nvarchar(150) NOT NULL,
        ProductVersion nvarchar(32) NOT NULL,
        CONSTRAINT PK_EFMigrationsHistory_Audit PRIMARY KEY (MigrationId)
    );

    CREATE TABLE __EFMigrationsHistory_Identity (
        MigrationId  nvarchar(150) NOT NULL,
        ProductVersion nvarchar(32) NOT NULL,
        CONSTRAINT PK_EFMigrationsHistory_Identity PRIMARY KEY (MigrationId)
    );

    CREATE TABLE __EFMigrationsHistory_ReferenceData (
        MigrationId  nvarchar(150) NOT NULL,
        ProductVersion nvarchar(32) NOT NULL,
        CONSTRAINT PK_EFMigrationsHistory_ReferenceData PRIMARY KEY (MigrationId)
    );

    CREATE TABLE __EFMigrationsHistory_Workflows (
        MigrationId  nvarchar(150) NOT NULL,
        ProductVersion nvarchar(32) NOT NULL,
        CONSTRAINT PK_EFMigrationsHistory_Workflows PRIMARY KEY (MigrationId)
    );

    CREATE TABLE __EFMigrationsHistory_Admissions (
        MigrationId  nvarchar(150) NOT NULL,
        ProductVersion nvarchar(32) NOT NULL,
        CONSTRAINT PK_EFMigrationsHistory_Admissions PRIMARY KEY (MigrationId)
    );

    -- Shared.Audit context owns: the immutability trigger migration
    INSERT INTO __EFMigrationsHistory_Audit (MigrationId, ProductVersion)
    SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
    WHERE MigrationId IN (
        '20260508121214_AuditImmutabilityTrigger'
    );

    -- Identity context owns: initial schema (system_users, sessions, AspNet Identity tables)
    INSERT INTO __EFMigrationsHistory_Identity (MigrationId, ProductVersion)
    SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
    WHERE MigrationId IN (
        '20260508121134_Initial'
    );

    -- ReferenceData context owns: reference data entries (from the full lookup CRUD schema)
    -- These will be managed by the new per-context InitialReferenceDataSnapshot migration
    -- (no legacy rows to assign here — reference_data_entries was part of the monolithic migrations)

    -- Admissions context owns: cycles, categories, applicants, admission_rules, the lookup extensions
    INSERT INTO __EFMigrationsHistory_Admissions (MigrationId, ProductVersion)
    SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
    WHERE MigrationId IN (
        '20260508121231_ReportSnapshotTables',
        '20260509130659_004_LookupsCrudExtensions',
        '20260509144412_004b_LookupsCrudCompleteSchema'
    );

    PRINT 'Migration history split complete.';
END
ELSE
BEGIN
    PRINT 'Migration history split already applied — skipping.';
END

COMMIT;
