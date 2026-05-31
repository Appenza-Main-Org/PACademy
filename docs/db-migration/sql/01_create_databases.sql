/* ============================================================================
   01_create_databases.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Create the two target databases for the environment-separation migration:
         [DB_PAcademy_Prod]     <- pacademy-admin-prod-api    + pacademy-applicant-prod-api
         [DB_PAcademy_Staging]  <- pacademy-admin-staging-api + pacademy-applicant-staging-api
     Both use the single canonical [dbo] schema (NO env-encoded schema names).
     Each CREATE is guarded by a sys.databases existence check, so re-running
     this script is a no-op once the databases exist (idempotent).

     The new databases' compatibility level is set to match the SOURCE
     database [PACademy] so behaviour is identical to today.

     This script does NOT create any application tables. The dbo tables are
     built by 02_build_dbo_schema.sql, which is GENERATED SEPARATELY by EF Core
     (see the "STEP 02" note below) and must run AFTER this script and BEFORE
     03_migrate_data.sql.

   PREREQUISITES
     - Run on the SQL Server that hosts the legacy [PACademy] DB (same instance:
       the target topology is two databases on the SAME server).
     - Login needs CREATE DATABASE / ALTER DATABASE (sysadmin or dbcreator).
     - 00_live_inventory_scan.sql has been run and its grids captured.
     - **REQUIRES A FULL BACKUP FIRST** of [PACademy].

   RUN ORDER
         00_live_inventory_scan.sql
     >>> 01_create_databases.sql      <-- YOU ARE HERE
         02_build_dbo_schema.sql      (EF-generated; see STEP 02 note — run next)
         03_migrate_data.sql          (run once per environment)
         04_sync_lookup_config.sql
         05_validate.sql
         06_rollback.sql

   INVOCATION
     Plain T-SQL — runs in SSMS / Azure Data Studio with NO sqlcmd mode.
     Execute the whole file once against the target server.

   ----------------------------------------------------------------------------
   STEP 02 — how 02_build_dbo_schema.sql is produced (DO THIS BETWEEN 01 and 03)
   ----------------------------------------------------------------------------
     The canonical dbo structure is the current PROD model rebuilt under dbo.
     Generate ONE idempotent migration script PER DbContext with the schema
     forced to dbo, then concatenate them into 02_build_dbo_schema.sql and run
     it against BOTH new databases. From the repo's backend/admin folder:

       # AdminDbContext (the ~24-table core) — force schema to dbo:
       ADMIN_DB_SCHEMA=dbo \
       dotnet ef migrations script --idempotent \
         --context AdminDbContext \
         --project PACademy.Admin.Api \
         -o ../../docs/db-migration/sql/02_build_dbo_schema_admin.sql

       # The three module contexts already emit schema-less (dbo) DDL:
       dotnet ef migrations script --idempotent \
         --context LookupsAdminDbContext \
         --project Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Infrastructure \
         -o ../../docs/db-migration/sql/02_build_dbo_schema_lookups.sql

       dotnet ef migrations script --idempotent \
         --context ApplicantGradesAdminDbContext \
         --project Modules/ApplicantGradesAdmin/PACademy.Modules.ApplicantGradesAdmin.Infrastructure \
         -o ../../docs/db-migration/sql/02_build_dbo_schema_grades.sql

       dotnet ef migrations script --idempotent \
         --context IdentityApplicantAdminDbContext \
         --project Modules/IdentityApplicantAdmin/PACademy.Modules.IdentityApplicantAdmin.Infrastructure \
         -o ../../docs/db-migration/sql/02_build_dbo_schema_identity.sql

     IMPORTANT — before generating 02_build_dbo_schema_admin.sql, the AdminDbContext snapshot
     and the two drift migrations must already target dbo (per the migration
     plan): AdminDbContext.DefaultSchema "admin_v2" -> "dbo", regenerate
     AdminDbContextModelSnapshot.cs, and purge the hardcoded "admin_v2" literals
     in 20260525120424_AddApplicantPortal.cs so applicant_portal_records /
     exam_slots land in dbo. Do NOT run the schema-rename migration
     20260526194218_PendingModelChanges against the new DBs.

     Each EF script writes its own __EFMigrationsHistory_* table inside dbo and
     marks every migration applied, so EF treats the new DBs as up-to-date.

     Run order for the generated parts (all four against EACH new DB):
       USE [DB_PAcademy_Prod];     :r 02_build_dbo_schema_admin.sql  02_build_dbo_schema_lookups.sql  02_build_dbo_schema_grades.sql  02_build_dbo_schema_identity.sql
       USE [DB_PAcademy_Staging];  :r 02_build_dbo_schema_admin.sql  02_build_dbo_schema_lookups.sql  02_build_dbo_schema_grades.sql  02_build_dbo_schema_identity.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* Capture the source compat level once so both targets match prod behaviour. */
DECLARE @sourceCompat int =
    CONVERT(int, DATABASEPROPERTYEX(N'PACademy', 'CompatibilityLevel'));

IF @sourceCompat IS NULL
BEGIN
    -- Source not visible from here (e.g. running on a fresh box). Fall back to
    -- the server default so the CREATE still succeeds; adjust later if needed.
    SET @sourceCompat = CONVERT(int, SERVERPROPERTY('ProductMajorVersion')) * 10;
    PRINT N'WARNING: [PACademy] not found on this instance. Falling back to '
        + N'compatibility level ' + CAST(@sourceCompat AS nvarchar(8))
        + N' (server default). Verify against the real source before 03.';
END
ELSE
    PRINT N'Source [PACademy] compatibility level = ' + CAST(@sourceCompat AS nvarchar(8));

DECLARE @sql nvarchar(max);

/* ---- DB_PAcademy_Prod -------------------------------------------------- */
IF DB_ID(N'DB_PAcademy_Prod') IS NULL
BEGIN
    PRINT N'Creating database [DB_PAcademy_Prod]...';
    EXEC sys.sp_executesql N'CREATE DATABASE [DB_PAcademy_Prod];';
END
ELSE
    PRINT N'[DB_PAcademy_Prod] already exists — skipping CREATE.';

SET @sql = N'ALTER DATABASE [DB_PAcademy_Prod] SET COMPATIBILITY_LEVEL = '
         + CAST(@sourceCompat AS nvarchar(8)) + N';';
EXEC sys.sp_executesql @sql;
PRINT N'[DB_PAcademy_Prod] compatibility level set to ' + CAST(@sourceCompat AS nvarchar(8)) + N'.';

/* ---- DB_PAcademy_Staging ----------------------------------------------- */
IF DB_ID(N'DB_PAcademy_Staging') IS NULL
BEGIN
    PRINT N'Creating database [DB_PAcademy_Staging]...';
    EXEC sys.sp_executesql N'CREATE DATABASE [DB_PAcademy_Staging];';
END
ELSE
    PRINT N'[DB_PAcademy_Staging] already exists — skipping CREATE.';

SET @sql = N'ALTER DATABASE [DB_PAcademy_Staging] SET COMPATIBILITY_LEVEL = '
         + CAST(@sourceCompat AS nvarchar(8)) + N';';
EXEC sys.sp_executesql @sql;
PRINT N'[DB_PAcademy_Staging] compatibility level set to ' + CAST(@sourceCompat AS nvarchar(8)) + N'.';
GO

/* dbo is the built-in default schema in every new SQL Server database — no
   CREATE SCHEMA needed. Confirm both targets expose it and report status.    */
SELECT
    d.name                                              AS database_name,
    CONVERT(int, DATABASEPROPERTYEX(d.name, 'CompatibilityLevel')) AS compatibility_level,
    DATABASEPROPERTYEX(d.name, 'Collation')             AS collation,
    DATABASEPROPERTYEX(d.name, 'Status')                AS status,
    N'dbo is the default schema (no extra schema created)' AS schema_note
FROM sys.databases AS d
WHERE d.name IN (N'DB_PAcademy_Prod', N'DB_PAcademy_Staging')
ORDER BY d.name;
GO

PRINT N'================================================================';
PRINT N' Target databases ready.';
PRINT N' NEXT: generate + run 02_build_dbo_schema.sql (EF Core, see header)';
PRINT N'       against BOTH new databases, THEN run 03_migrate_data.sql.';
PRINT N'================================================================';
GO
