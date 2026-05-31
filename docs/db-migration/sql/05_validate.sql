/* ============================================================================
   05_validate.sql
   ----------------------------------------------------------------------------
   PURPOSE
     READ-ONLY post-migration validation report comparing [DB_PAcademy_Prod]
     against [DB_PAcademy_Staging] (both dbo). This is the validation artifact
     for the migration runbook. It produces several result grids:

       A. DATABASE-LEVEL TOTALS — table count, total column count, FK count,
          index count, and view/procedure/function/trigger counts, side by
          side with a MISMATCH flag.
       B. STRUCTURAL OBJECT DIFF — base tables present in one DB but not the
          other (should be empty after step 02).
       C. EF MIGRATIONS HISTORY DIFF — each context's history table compared
          (same set of applied MigrationIds expected in both).
       D. LOOKUP / CONFIG / IDENTITY ROW-COUNT PARITY — per-table row counts
          for the tables that MUST be identical (set mirrors 04), each with a
          MISMATCH flag. These are the rows that prove 04 converged.
       E. TRANSACTIONAL ROW COUNTS — informational only (volumes may differ;
          NO mismatch flag).

     "MISMATCH" in grids A and D means prod <> staging where they should match.
     Grid E never flags — it is expected to differ.

     This script CHANGES NOTHING.

   PREREQUISITES
     - 01..04 complete for both DBs.
     - Login has SELECT on both target catalogs.
     - **REQUIRES A FULL BACKUP FIRST** (policy; this script is read-only).

   RUN ORDER
         00 -> 01 -> 02 -> 03 (x2) -> 04 ->
     >>> 05_validate.sql   <-- YOU ARE HERE
         06 (rollback, only if needed)

   INVOCATION
     Plain T-SQL — runs in SSMS / Azure Data Studio. No sqlcmd mode required.
     The two DB names are parameterized below if you ever rename the targets.
   ============================================================================ */

SET NOCOUNT ON;

DECLARE @ProdDb    sysname = N'DB_PAcademy_Prod';
DECLARE @StageDb   sysname = N'DB_PAcademy_Staging';
DECLARE @Schema    sysname = N'dbo';
DECLARE @sql       nvarchar(max);

IF DB_ID(@ProdDb)  IS NULL BEGIN RAISERROR(N'[%s] not found.',16,1,@ProdDb);  RETURN; END
IF DB_ID(@StageDb) IS NULL BEGIN RAISERROR(N'[%s] not found.',16,1,@StageDb); RETURN; END

PRINT N'================================================================';
PRINT N' Validation report: [' + @ProdDb + N']  vs  [' + @StageDb + N']';
PRINT N'================================================================';

/* ============================  GRID A  ============================== */
/* Database-level totals, side by side, with MISMATCH flag.            */
/* Each metric is gathered per-DB via dynamic SQL then pivoted.         */
DECLARE @metrics TABLE (which sysname, metric sysname, value bigint);

DECLARE @grabSql nvarchar(max) = N'
    SELECT @db AS which, N''tables'' AS metric, COUNT(*) AS value
      FROM [{DB}].sys.tables t JOIN [{DB}].sys.schemas s ON s.schema_id=t.schema_id
      WHERE s.name=@sch AND t.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    UNION ALL
    SELECT @db, N''columns'', COUNT(*)
      FROM [{DB}].sys.columns c
      JOIN [{DB}].sys.tables t ON t.object_id=c.object_id
      JOIN [{DB}].sys.schemas s ON s.schema_id=t.schema_id
      WHERE s.name=@sch AND t.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    UNION ALL
    SELECT @db, N''foreign_keys'', COUNT(*)
      FROM [{DB}].sys.foreign_keys fk
      JOIN [{DB}].sys.tables t ON t.object_id=fk.parent_object_id
      JOIN [{DB}].sys.schemas s ON s.schema_id=t.schema_id
      WHERE s.name=@sch
    UNION ALL
    SELECT @db, N''indexes'', COUNT(*)
      FROM [{DB}].sys.indexes i
      JOIN [{DB}].sys.tables t ON t.object_id=i.object_id
      JOIN [{DB}].sys.schemas s ON s.schema_id=t.schema_id
      WHERE s.name=@sch AND i.type>0
        AND t.name NOT LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    UNION ALL
    SELECT @db, N''views'', COUNT(*) FROM [{DB}].sys.views
    UNION ALL
    SELECT @db, N''procedures'', COUNT(*) FROM [{DB}].sys.procedures
    UNION ALL
    SELECT @db, N''functions'', COUNT(*) FROM [{DB}].sys.objects WHERE type IN (N''FN'',N''IF'',N''TF'')
    UNION ALL
    SELECT @db, N''triggers'', COUNT(*) FROM [{DB}].sys.triggers WHERE is_ms_shipped=0;';

SET @sql = REPLACE(@grabSql, N'{DB}', @ProdDb);
INSERT INTO @metrics EXEC sys.sp_executesql @sql, N'@db sysname, @sch sysname', @db=@ProdDb, @sch=@Schema;

SET @sql = REPLACE(@grabSql, N'{DB}', @StageDb);
INSERT INTO @metrics EXEC sys.sp_executesql @sql, N'@db sysname, @sch sysname', @db=@StageDb, @sch=@Schema;

SELECT
    N'A_db_totals'                                  AS section,
    p.metric,
    p.value                                         AS prod,
    s.value                                         AS staging,
    CASE WHEN p.value <> s.value THEN N'MISMATCH' ELSE N'OK' END AS status
FROM (SELECT metric, value FROM @metrics WHERE which=@ProdDb)  AS p
JOIN (SELECT metric, value FROM @metrics WHERE which=@StageDb) AS s
     ON s.metric = p.metric
ORDER BY p.metric;

/* ============================  GRID B  ============================== */
/* Structural object diff: base tables in one DB but not the other.    */
SET @sql = N'
    SELECT N''B_table_diff'' AS section, name AS table_name,
           N''ONLY IN ' + @ProdDb + N''' AS present_in
    FROM (SELECT t.name FROM [' + @ProdDb + N'].sys.tables t
          JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@sch) p
    WHERE name NOT IN (SELECT t.name FROM [' + @StageDb + N'].sys.tables t
          JOIN [' + @StageDb + N'].sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@sch)
    UNION ALL
    SELECT N''B_table_diff'', name,
           N''ONLY IN ' + @StageDb + N'''
    FROM (SELECT t.name FROM [' + @StageDb + N'].sys.tables t
          JOIN [' + @StageDb + N'].sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@sch) g
    WHERE name NOT IN (SELECT t.name FROM [' + @ProdDb + N'].sys.tables t
          JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@sch)
    ORDER BY table_name, present_in;';
EXEC sys.sp_executesql @sql, N'@sch sysname', @sch=@Schema;

/* ============================  GRID C  ============================== */
/* EF migrations-history parity per context. Builds a full-outer compare */
/* of (history_table, MigrationId) across both DBs. History rows live in   */
/* differently-named tables (one per context), so a single static query    */
/* cannot read them generically — dynamically UNION ALL every history      */
/* table in each DB, then FULL OUTER JOIN on (history_table, MigrationId).  */

DECLARE @prodHist nvarchar(max) = N'';
DECLARE @stageHist nvarchar(max) = N'';

/* Build prod side */
SET @sql = N'
    SELECT @acc = STRING_AGG(stmt, N'' UNION ALL '')
    FROM (
        SELECT N''SELECT N'''''' + t.name + N'''''' AS history_table, CAST([MigrationId] AS nvarchar(300)) AS MigrationId FROM '' '
        + N'+ QUOTENAME(@db) + N''.'' + QUOTENAME(@sch) + N''.'' + QUOTENAME(t.name) AS stmt
        FROM [' + @ProdDb + N'].sys.tables t
        JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id
        WHERE s.name=@sch AND t.name LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    ) q;';
EXEC sys.sp_executesql @sql, N'@acc nvarchar(max) OUTPUT, @db sysname, @sch sysname',
     @acc=@prodHist OUTPUT, @db=@ProdDb, @sch=@Schema;

/* Build staging side */
SET @sql = N'
    SELECT @acc = STRING_AGG(stmt, N'' UNION ALL '')
    FROM (
        SELECT N''SELECT N'''''' + t.name + N'''''' AS history_table, CAST([MigrationId] AS nvarchar(300)) AS MigrationId FROM '' '
        + N'+ QUOTENAME(@db) + N''.'' + QUOTENAME(@sch) + N''.'' + QUOTENAME(t.name) AS stmt
        FROM [' + @StageDb + N'].sys.tables t
        JOIN [' + @StageDb + N'].sys.schemas s ON s.schema_id=t.schema_id
        WHERE s.name=@sch AND t.name LIKE N''\_\_EFMigrationsHistory%'' ESCAPE N''\''
    ) q;';
EXEC sys.sp_executesql @sql, N'@acc nvarchar(max) OUTPUT, @db sysname, @sch sysname',
     @acc=@stageHist OUTPUT, @db=@StageDb, @sch=@Schema;

IF @prodHist IS NULL OR @stageHist IS NULL
    PRINT N'GRID C skipped: no __EFMigrationsHistory tables in one or both DBs.';
ELSE
BEGIN
    SET @sql = N'
        WITH prod AS (' + @prodHist + N'),
             stg  AS (' + @stageHist + N')
        SELECT N''C_migration_history'' AS section,
               COALESCE(p.history_table, s.history_table) AS history_table,
               COALESCE(p.MigrationId, s.MigrationId)      AS migration_id,
               CASE WHEN p.MigrationId IS NULL THEN N''MISSING IN PROD''
                    WHEN s.MigrationId IS NULL THEN N''MISSING IN STAGING''
                    ELSE N''OK'' END                        AS status
        FROM prod p
        FULL OUTER JOIN stg s
          ON s.history_table = p.history_table AND s.MigrationId = p.MigrationId
        ORDER BY history_table, migration_id;';
    EXEC sys.sp_executesql @sql;
END

/* ============================  GRID D  ============================== */
/* Lookup / config / identity row-count parity (set mirrors 04).        */
/* Per-table prod vs staging counts with a MISMATCH flag.               */
DECLARE @parity TABLE (table_name sysname);
INSERT INTO @parity (table_name) VALUES
    (N'lookup_rows'),
    (N'faculties'),
    (N'applicant_categories'),
    (N'admission_cycles'),
    (N'admission_rules'),
    (N'application_settings_category_configs'),
    (N'application_settings_category_specializations'),
    (N'application_settings_graduation_years'),
    (N'general_settings'),
    (N'roles'),
    (N'exam_questions'),
    (N'exam_question_options'),
    (N'exam_question_matching_pairs'),
    (N'exams'),
    (N'exam_rules'),
    (N'exam_question_links');

DECLARE @counts TABLE (which sysname, table_name sysname, row_count bigint);
DECLARE @pt sysname;

DECLARE pc CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @parity ORDER BY table_name;
OPEN pc; FETCH NEXT FROM pc INTO @pt;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- prod count (only if table exists)
    SET @sql = N'
        IF EXISTS (SELECT 1 FROM [' + @ProdDb + N'].sys.tables t
                   JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id
                   WHERE s.name=@sch AND t.name=@tbl)
        SELECT @db, @tbl, ISNULL(SUM(ps.row_count),0)
        FROM [' + @ProdDb + N'].sys.tables t
        JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id
        JOIN [' + @ProdDb + N'].sys.dm_db_partition_stats ps
             ON ps.object_id=t.object_id AND ps.index_id IN (0,1)
        WHERE s.name=@sch AND t.name=@tbl;';
    INSERT INTO @counts
    EXEC sys.sp_executesql @sql, N'@db sysname, @sch sysname, @tbl sysname',
         @db=@ProdDb, @sch=@Schema, @tbl=@pt;

    -- staging count
    SET @sql = N'
        IF EXISTS (SELECT 1 FROM [' + @StageDb + N'].sys.tables t
                   JOIN [' + @StageDb + N'].sys.schemas s ON s.schema_id=t.schema_id
                   WHERE s.name=@sch AND t.name=@tbl)
        SELECT @db, @tbl, ISNULL(SUM(ps.row_count),0)
        FROM [' + @StageDb + N'].sys.tables t
        JOIN [' + @StageDb + N'].sys.schemas s ON s.schema_id=t.schema_id
        JOIN [' + @StageDb + N'].sys.dm_db_partition_stats ps
             ON ps.object_id=t.object_id AND ps.index_id IN (0,1)
        WHERE s.name=@sch AND t.name=@tbl;';
    INSERT INTO @counts
    EXEC sys.sp_executesql @sql, N'@db sysname, @sch sysname, @tbl sysname',
         @db=@StageDb, @sch=@Schema, @tbl=@pt;

    FETCH NEXT FROM pc INTO @pt;
END
CLOSE pc; DEALLOCATE pc;

SELECT
    N'D_lookup_config_parity'                       AS section,
    pr.table_name,
    ISNULL(p.row_count, -1)                         AS prod,    -- -1 = table absent
    ISNULL(s.row_count, -1)                         AS staging,
    CASE
        WHEN p.row_count IS NULL OR s.row_count IS NULL THEN N'MISSING TABLE'
        WHEN p.row_count <> s.row_count THEN N'MISMATCH'
        ELSE N'OK'
    END                                             AS status
FROM @parity AS pr
LEFT JOIN (SELECT table_name, row_count FROM @counts WHERE which=@ProdDb)  AS p ON p.table_name = pr.table_name
LEFT JOIN (SELECT table_name, row_count FROM @counts WHERE which=@StageDb) AS s ON s.table_name = pr.table_name
ORDER BY pr.table_name;

/* ============================  GRID E  ============================== */
/* Transactional tables — informational row counts (NO mismatch flag).  */
DECLARE @txn TABLE (table_name sysname);
INSERT INTO @txn (table_name) VALUES
    (N'admin_records'),                 -- expected empty (drained) in prod
    (N'admin_record_documents'),
    (N'audit_entries'),
    (N'exam_assignments'),
    (N'exam_slots'),                    -- applicant seeder may add rows
    (N'applicant_portal_records'),
    (N'users'),                         -- bootstrap + operational (prod-only)
    (N'officer_directory'),
    (N'applicants'),
    (N'applicant_grades'),
    (N'applicant_grade_adjustments'),
    (N'grade_import_batches'),
    (N'grade_import_rows');

DECLARE @txnCounts TABLE (which sysname, table_name sysname, row_count bigint);
DECLARE @xt sysname;
DECLARE xc CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @txn ORDER BY table_name;
OPEN xc; FETCH NEXT FROM xc INTO @xt;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'
        IF EXISTS (SELECT 1 FROM [' + @ProdDb + N'].sys.tables t
                   JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id
                   WHERE s.name=@sch AND t.name=@tbl)
        SELECT @db, @tbl, ISNULL(SUM(ps.row_count),0)
        FROM [' + @ProdDb + N'].sys.dm_db_partition_stats ps
        JOIN [' + @ProdDb + N'].sys.tables t ON t.object_id=ps.object_id
        JOIN [' + @ProdDb + N'].sys.schemas s ON s.schema_id=t.schema_id
        WHERE ps.index_id IN (0,1) AND s.name=@sch AND t.name=@tbl;';
    INSERT INTO @txnCounts EXEC sys.sp_executesql @sql,
        N'@db sysname, @sch sysname, @tbl sysname', @db=@ProdDb, @sch=@Schema, @tbl=@xt;

    SET @sql = REPLACE(@sql, @ProdDb, @StageDb);
    INSERT INTO @txnCounts EXEC sys.sp_executesql @sql,
        N'@db sysname, @sch sysname, @tbl sysname', @db=@StageDb, @sch=@Schema, @tbl=@xt;

    FETCH NEXT FROM xc INTO @xt;
END
CLOSE xc; DEALLOCATE xc;

SELECT
    N'E_transactional_counts'                       AS section,
    tx.table_name,
    ISNULL(p.row_count, -1)                         AS prod,
    ISNULL(s.row_count, -1)                         AS staging,
    N'informational only — volumes may differ'      AS note
FROM @txn AS tx
LEFT JOIN (SELECT table_name, row_count FROM @txnCounts WHERE which=@ProdDb)  AS p ON p.table_name = tx.table_name
LEFT JOIN (SELECT table_name, row_count FROM @txnCounts WHERE which=@StageDb) AS s ON s.table_name = tx.table_name
ORDER BY tx.table_name;

PRINT N'================================================================';
PRINT N' Validation report complete. Review grids A & D for MISMATCH rows.';
PRINT N' Grid B/C should show zero structural / history differences.';
PRINT N'================================================================';
GO
