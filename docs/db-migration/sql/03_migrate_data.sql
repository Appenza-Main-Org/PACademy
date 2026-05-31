/* ============================================================================
   03_migrate_data.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Catalog-driven (metadata-driven) cross-DATABASE data copy from a legacy
     schema in [PACademy] into the canonical [dbo] schema of a freshly-built
     target database. Column lists are built DYNAMICALLY from sys.columns so
     the copy survives minor drift between source and target. ROWVERSION
     columns (system_type_id = 189) are excluded from every INSERT because
     SQL Server forbids inserting into them. SET IDENTITY_INSERT is toggled
     ONLY for tables that actually have an identity column (none today, but the
     guard keeps the script correct under future drift). Target FK constraints
     are disabled for the load and re-enabled WITH CHECK afterward.

     The SAME script serves both environments via the @SourceSchema /
     @TargetDb parameters — set them at the top, then run.

   ----------------------------------------------------------------------------
   INVOCATIONS  (edit the @vars below, then execute the whole file — run it ONCE
                 PER (source-schema, target-DB) pair: FOUR passes total)

     The admin tables live under the env schema (admin_v2 / PACademy_staging_db).
     The six MODULE-context tables — faculties, applicants, applicant_grades,
     applicant_grade_adjustments, grade_import_batches, grade_import_rows — live
     under [PACademy].[dbo] (Railway sets ConnectionStrings__Default -> Database=PACademy
     on BOTH admin services, and those contexts have no HasDefaultSchema, so they
     resolve to the login's dbo). They are SHARED by both envs today, so each target
     DB also needs a dbo -> dbo pass to receive them.

     PROD  admin   : @SourceDb=N'PACademy'  @SourceSchema=N'admin_v2'             @TargetDb=N'DB_PAcademy_Prod'
     PROD  modules : @SourceDb=N'PACademy'  @SourceSchema=N'dbo'                  @TargetDb=N'DB_PAcademy_Prod'
     STAGE admin   : @SourceDb=N'PACademy'  @SourceSchema=N'PACademy_staging_db'  @TargetDb=N'DB_PAcademy_Staging'
     STAGE modules : @SourceDb=N'PACademy'  @SourceSchema=N'dbo'                  @TargetDb=N'DB_PAcademy_Staging'

     FIRST confirm the module tables' real location from 00_live_inventory_scan.sql.
     If a separate physical database literally named [PACademy_staging_db] turns out
     to hold them, add a pass with @SourceDb=N'PACademy_staging_db' @SourceSchema=N'dbo'.

   ----------------------------------------------------------------------------
   STAGING DRIFT CAVEAT
     The staging schema [PACademy_staging_db] is known to be drifted:
       - applicant_portal_records / exam_slots were created by migration
         20260525120424_AddApplicantPortal with a HARDCODED "admin_v2" schema,
         so they may be MISSING from [PACademy_staging_db] (they live under
         admin_v2 instead).
       - a duplicate [users] table exists in BOTH schemas.
     This script copies ONLY tables that exist in BOTH the source schema AND
     target dbo (INNER JOIN on name), so missing-in-staging tables are simply
     skipped — they are NOT errors. STRUCTURAL parity of the target is already
     guaranteed by step 02 (every dbo table exists regardless of source drift).
     CONFIG / LOOKUP / IDENTITY parity between the two target DBs is then
     enforced by 04_sync_lookup_config.sql (prod is source of truth). So if a
     lookup/config table came up short or empty on the staging copy here, 04
     backfills it from DB_PAcademy_Prod.dbo — do not hand-patch it in this step.

   IDEMPOTENCY
     This is a bulk INSERT...SELECT load intended for a FRESHLY built target
     (post-02, empty tables). It is NOT a merge. Re-running against an already
     populated target will raise PK violations (by design — it should not be
     re-run blindly). To re-load, truncate/rebuild the target DB first, or use
     04 (MERGE) for the lookup/config subset. The per-table work runs inside a
     TRY/CATCH so one failure stops the run with a clear message rather than a
     half-applied table.

   PREREQUISITES
     - 00, 01 done; 02_build_dbo_schema.sql applied to the target DB (all dbo
       tables + the four __EFMigrationsHistory_* tables exist).
     - Login has SELECT on [PACademy].[<schema>] and INSERT/ALTER on the target.
     - Both databases live on the SAME server (3-part names used throughout).
     - **REQUIRES A FULL BACKUP FIRST** of [PACademy] and the target DB.

   RUN ORDER
         00 -> 01 -> 02 (EF) ->
     >>> 03_migrate_data.sql   <-- YOU ARE HERE (run once per environment)
         04 -> 05 -> 06
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ==========================  PARAMETERS  ============================== */
/* >>> EDIT THESE THREE FOR EACH ENVIRONMENT, THEN RUN <<<                */
DECLARE @SourceDb     sysname = N'PACademy';
DECLARE @SourceSchema sysname = N'admin_v2';              -- prod: admin_v2 | staging: PACademy_staging_db
DECLARE @TargetDb     sysname = N'DB_PAcademy_Prod';      -- prod: DB_PAcademy_Prod | staging: DB_PAcademy_Staging
DECLARE @TargetSchema sysname = N'dbo';                   -- canonical target schema (do not change)
/* ===================================================================== */

DECLARE @sql      nvarchar(max);
DECLARE @msg      nvarchar(2048);

/* ---- guard rails ----------------------------------------------------- */
IF DB_ID(@SourceDb) IS NULL
BEGIN
    RAISERROR(N'Source database [%s] not found on this server.', 16, 1, @SourceDb); RETURN;
END
IF DB_ID(@TargetDb) IS NULL
BEGIN
    RAISERROR(N'Target database [%s] not found. Run 01 + 02 first.', 16, 1, @TargetDb); RETURN;
END

PRINT N'================================================================';
PRINT N' Data migration';
PRINT N'   source : [' + @SourceDb + N'].[' + @SourceSchema + N']';
PRINT N'   target : [' + @TargetDb + N'].[' + @TargetSchema + N']';
PRINT N'================================================================';

/* Confirm the source schema actually exists in the source DB. */
SET @sql = N'IF SCHEMA_ID(@s) IS NULL RAISERROR(N''Source schema [%s] not found in [' + @SourceDb + N'].'', 16, 1, @s);';
EXEC [PACademy]..sp_executesql @sql, N'@s sysname', @s = @SourceSchema;
-- NOTE: the line above runs in [PACademy]; if you ever point @SourceDb elsewhere,
-- replace the [PACademy].. prefix accordingly. Kept explicit for clarity.

/* ------------------------------------------------------------------ */
/* Build the worklist: every BASE table that exists in BOTH the source */
/* schema and the target dbo. Skip the EF history tables (step 02      */
/* already seeded them via the idempotent EF scripts — copying source  */
/* history rows would double them / mismatch the dbo rebuild).         */
/* ------------------------------------------------------------------ */
DECLARE @work TABLE (ordinal int IDENTITY(1,1), table_name sysname);

SET @sql = N'
    SELECT st.name
    FROM [' + @SourceDb + N'].sys.tables AS st
    JOIN [' + @SourceDb + N'].sys.schemas AS ss ON ss.schema_id = st.schema_id
    WHERE ss.name = @srcSchema
      AND st.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
      AND EXISTS (
            SELECT 1
            FROM [' + @TargetDb + N'].sys.tables AS tt
            JOIN [' + @TargetDb + N'].sys.schemas AS ts ON ts.schema_id = tt.schema_id
            WHERE ts.name = @tgtSchema AND tt.name = st.name)
    ORDER BY st.name;';

INSERT INTO @work (table_name)
EXEC sys.sp_executesql @sql,
     N'@srcSchema sysname, @tgtSchema sysname',
     @srcSchema = @SourceSchema, @tgtSchema = @TargetSchema;

IF NOT EXISTS (SELECT 1 FROM @work)
BEGIN
    RAISERROR(N'No tables found in both [%s].[%s] and [%s].[dbo]. Did step 02 run against the target?',
              16, 1, @SourceDb, @SourceSchema, @TargetDb);
    RETURN;
END

PRINT N'Tables to copy: ' + CAST((SELECT COUNT(*) FROM @work) AS nvarchar(8));

/* Report which source tables were SKIPPED because they are absent from   */
/* the target dbo (informational — usually none after a correct step 02). */
SET @sql = N'
    SELECT N''SKIPPED (not in target dbo)'' AS note, st.name AS source_table
    FROM [' + @SourceDb + N'].sys.tables AS st
    JOIN [' + @SourceDb + N'].sys.schemas AS ss ON ss.schema_id = st.schema_id
    WHERE ss.name = @srcSchema
      AND st.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
      AND NOT EXISTS (
            SELECT 1 FROM [' + @TargetDb + N'].sys.tables AS tt
            JOIN [' + @TargetDb + N'].sys.schemas AS ts ON ts.schema_id = tt.schema_id
            WHERE ts.name = @tgtSchema AND tt.name = st.name)
    ORDER BY st.name;';
EXEC sys.sp_executesql @sql,
     N'@srcSchema sysname, @tgtSchema sysname',
     @srcSchema = @SourceSchema, @tgtSchema = @TargetSchema;

/* ------------------------------------------------------------------ */
/* PHASE 1 — disable ALL FK constraints on the target tables so we can  */
/* load in any order (the 5 real FKs are ON DELETE CASCADE; load order  */
/* is irrelevant once they're NOCHECK).                                 */
/* ------------------------------------------------------------------ */
PRINT N'--- disabling target FK constraints ---';
DECLARE @t sysname;
DECLARE c_off CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @work ORDER BY ordinal;
OPEN c_off; FETCH NEXT FROM c_off INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[' + @TargetSchema + N'].' + QUOTENAME(@t)
             + N' NOCHECK CONSTRAINT ALL;';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM c_off INTO @t;
END
CLOSE c_off; DEALLOCATE c_off;

/* ------------------------------------------------------------------ */
/* PHASE 2 — copy each table. Dynamic non-rowversion / non-computed     */
/* column list shared by INSERT target and SELECT source. IDENTITY_INSERT*/
/* only when an identity column exists on the TARGET table.             */
/* ------------------------------------------------------------------ */
PRINT N'--- copying data ---';
DECLARE @copied int = 0, @rows bigint = 0, @hasIdentity bit, @colList nvarchar(max);

DECLARE c_copy CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @work ORDER BY ordinal;
OPEN c_copy; FETCH NEXT FROM c_copy INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        /* Build the column list from the TARGET dbo definition (authoritative
           shape post step-02). Exclude:
             - computed columns (is_computed = 1)         -> cannot be inserted
             - rowversion columns (system_type_id = 189)  -> cannot be inserted
           Intersect with source columns by name so any source-only column is
           ignored (drift-safe). */
        SET @colList = NULL;
        SET @sql = N'
            SELECT @cl = STRING_AGG(QUOTENAME(tc.name), N'', '')
                          WITHIN GROUP (ORDER BY tc.column_id)
            FROM [' + @TargetDb + N'].sys.columns AS tc
            JOIN [' + @TargetDb + N'].sys.tables  AS tt ON tt.object_id = tc.object_id
            JOIN [' + @TargetDb + N'].sys.schemas AS ts ON ts.schema_id = tt.schema_id
            WHERE ts.name = @tgtSchema AND tt.name = @tbl
              AND tc.is_computed = 0
              AND tc.system_type_id <> 189      /* 189 = timestamp / rowversion */
              AND EXISTS (
                    SELECT 1
                    FROM [' + @SourceDb + N'].sys.columns AS sc
                    JOIN [' + @SourceDb + N'].sys.tables  AS st2 ON st2.object_id = sc.object_id
                    JOIN [' + @SourceDb + N'].sys.schemas AS ss2 ON ss2.schema_id = st2.schema_id
                    WHERE ss2.name = @srcSchema AND st2.name = @tbl
                      AND sc.name = tc.name);';
        EXEC sys.sp_executesql @sql,
             N'@cl nvarchar(max) OUTPUT, @tgtSchema sysname, @srcSchema sysname, @tbl sysname',
             @cl = @colList OUTPUT, @tgtSchema = @TargetSchema, @srcSchema = @SourceSchema, @tbl = @t;

        IF @colList IS NULL OR LEN(@colList) = 0
        BEGIN
            SET @msg = N'  ' + @t + N': no insertable columns in common — skipped.';
            PRINT @msg;
            FETCH NEXT FROM c_copy INTO @t; CONTINUE;
        END

        /* Does the TARGET table have an identity column? */
        SET @hasIdentity = 0;
        SET @sql = N'
            SELECT @hi = CASE WHEN EXISTS (
                SELECT 1
                FROM [' + @TargetDb + N'].sys.identity_columns AS ic
                JOIN [' + @TargetDb + N'].sys.tables  AS tt ON tt.object_id = ic.object_id
                JOIN [' + @TargetDb + N'].sys.schemas AS ts ON ts.schema_id = tt.schema_id
                WHERE ts.name = @tgtSchema AND tt.name = @tbl) THEN 1 ELSE 0 END;';
        EXEC sys.sp_executesql @sql,
             N'@hi bit OUTPUT, @tgtSchema sysname, @tbl sysname',
             @hi = @hasIdentity OUTPUT, @tgtSchema = @TargetSchema, @tbl = @t;

        /* Compose and run the copy. IDENTITY_INSERT only wraps when needed.   */
        DECLARE @tgtFq nvarchar(512) =
            QUOTENAME(@TargetDb) + N'.' + QUOTENAME(@TargetSchema) + N'.' + QUOTENAME(@t);
        DECLARE @srcFq nvarchar(512) =
            QUOTENAME(@SourceDb) + N'.' + QUOTENAME(@SourceSchema) + N'.' + QUOTENAME(@t);

        SET @sql =
            CASE WHEN @hasIdentity = 1 THEN N'SET IDENTITY_INSERT ' + @tgtFq + N' ON;' + CHAR(10) ELSE N'' END
          + N'INSERT INTO ' + @tgtFq + N' (' + @colList + N')' + CHAR(10)
          + N'SELECT ' + @colList + N' FROM ' + @srcFq + N';' + CHAR(10)
          + CASE WHEN @hasIdentity = 1 THEN N'SET IDENTITY_INSERT ' + @tgtFq + N' OFF;' ELSE N'' END;

        EXEC sys.sp_executesql @sql;
        SET @rows = @@ROWCOUNT;
        SET @copied += 1;

        SET @msg = N'  copied ' + @t + N' (' + CAST(@rows AS nvarchar(20)) + N' rows'
                 + CASE WHEN @hasIdentity = 1 THEN N', IDENTITY_INSERT' ELSE N'' END + N')';
        PRINT @msg;
    END TRY
    BEGIN CATCH
        /* Ensure IDENTITY_INSERT is not left ON if the INSERT failed mid-table. */
        BEGIN TRY
            IF @hasIdentity = 1
                EXEC sys.sp_executesql
                     (N'SET IDENTITY_INSERT ' + QUOTENAME(@TargetDb) + N'.'
                      + QUOTENAME(@TargetSchema) + N'.' + QUOTENAME(@t) + N' OFF;');
        END TRY BEGIN CATCH /* swallow */ END CATCH;

        SET @msg = N'FAILED on table [' + @t + N']: ' + ERROR_MESSAGE();
        /* Re-enable constraints best-effort before aborting so the target is
           left in a checkable state, then surface the error and stop. */
        PRINT @msg;
        PRINT N'--- re-enabling target FK constraints after failure ---';
        DECLARE c_rb CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @work ORDER BY ordinal;
        OPEN c_rb; FETCH NEXT FROM c_rb INTO @t;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            BEGIN TRY
                EXEC sys.sp_executesql
                     (N'ALTER TABLE ' + QUOTENAME(@TargetDb) + N'.' + QUOTENAME(@TargetSchema)
                      + N'.' + QUOTENAME(@t) + N' WITH CHECK CHECK CONSTRAINT ALL;');
            END TRY BEGIN CATCH /* leave NOCHECK; reported by 05 */ END CATCH;
            FETCH NEXT FROM c_rb INTO @t;
        END
        CLOSE c_rb; DEALLOCATE c_rb;

        ;THROW;   -- stop the run; nothing was committed for the failing table
    END CATCH;

    FETCH NEXT FROM c_copy INTO @t;
END
CLOSE c_copy; DEALLOCATE c_copy;

/* ------------------------------------------------------------------ */
/* PHASE 3 — re-enable + re-validate FK constraints (WITH CHECK CHECK   */
/* forces SQL Server to verify existing rows; any untrusted/violating   */
/* FK will raise here and is also reported by 05).                      */
/* ------------------------------------------------------------------ */
PRINT N'--- re-enabling + validating target FK constraints ---';
DECLARE c_on CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @work ORDER BY ordinal;
OPEN c_on; FETCH NEXT FROM c_on INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[' + @TargetSchema + N'].' + QUOTENAME(@t)
             + N' WITH CHECK CHECK CONSTRAINT ALL;';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM c_on INTO @t;
END
CLOSE c_on; DEALLOCATE c_on;

/* ------------------------------------------------------------------ */
/* SUMMARY — per-table row counts in the target after the load.         */
/* ------------------------------------------------------------------ */
PRINT N'--- post-copy target row counts ---';
SET @sql = N'
    SELECT N''' + @TargetDb + N''' AS target_db, t.name AS table_name,
           SUM(ps.row_count) AS row_count
    FROM [' + @TargetDb + N'].sys.tables AS t
    JOIN [' + @TargetDb + N'].sys.schemas AS s ON s.schema_id = t.schema_id
    JOIN [' + @TargetDb + N'].sys.dm_db_partition_stats AS ps
         ON ps.object_id = t.object_id AND ps.index_id IN (0,1)
    WHERE s.name = @tgtSchema
      AND t.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    GROUP BY t.name
    ORDER BY t.name;';
EXEC sys.sp_executesql @sql, N'@tgtSchema sysname', @tgtSchema = @TargetSchema;

PRINT N'================================================================';
SET @msg = N' Data migration complete. Tables copied: ' + CAST(@copied AS nvarchar(8))
         + N'  ->  [' + @TargetDb + N'].[' + @TargetSchema + N']';
PRINT @msg;
PRINT N' Run 03 again with the STAGING parameters if you have not yet.';
PRINT N' Then run 04_sync_lookup_config.sql, then 05_validate.sql.';
PRINT N'================================================================';
GO
