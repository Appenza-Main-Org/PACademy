/* ============================================================================
   00_live_inventory_scan.sql
   ----------------------------------------------------------------------------
   PURPOSE
     READ-ONLY discovery scan of the CURRENT (drifted) live database [PACademy].
     Emits the dataset the migration reports reference: a per-table inventory
     (row_count, column_count, fk_count, index_count) for BOTH legacy schemas
     [admin_v2] (prod) and [PACademy_staging_db] (staging), a list of all
     schemas, all programmable objects (views / procs / functions / triggers),
     every __EFMigrationsHistory* table with its applied-migration rows, and a
     flag for any duplicate table NAME that exists in BOTH schemas (the known
     [users] / applicant_portal drift).

     This script CHANGES NOTHING. It is safe to run on the live server as the
     very first step. Capture every result grid — they feed 03/04/05.

   PREREQUISITES
     - Run on the SQL Server that hosts [PACademy] (34.17.135.245,1433).
     - Login needs VIEW DEFINITION + SELECT on [PACademy] catalog views.
     - **REQUIRES A FULL BACKUP FIRST** (policy for every script in this set;
       this one is read-only, but never operate on the live box without a
       current, restorable backup in hand).

   RUN ORDER
     >>> 00_live_inventory_scan.sql   <-- YOU ARE HERE (read-only baseline)
         01_create_databases.sql
         02_build_dbo_schema.sql      (generated separately by EF Core; see 01)
         03_migrate_data.sql          (run once per environment)
         04_sync_lookup_config.sql
         05_validate.sql
         06_rollback.sql              (only if backing out)

   INVOCATION
     Plain T-SQL — runs in SSMS / Azure Data Studio with NO sqlcmd mode.
     Just open against the server and execute. No variables to set.
   ============================================================================ */

SET NOCOUNT ON;
USE [PACademy];
GO

PRINT N'================================================================';
PRINT N' PACademy live inventory scan  (read-only)';
PRINT N' Server : ' + CAST(SERVERPROPERTY('ServerName') AS nvarchar(256));
PRINT N' Database: ' + DB_NAME() + N'   (compat level '
      + CAST(CONVERT(int, DATABASEPROPERTYEX(DB_NAME(), 'CompatibilityLevel')) AS nvarchar(8)) + N')';
PRINT N' Run at  : ' + CONVERT(nvarchar(33), SYSDATETIMEOFFSET(), 126);
PRINT N'================================================================';
GO

/* ------------------------------------------------------------------ */
/* 1. ALL SCHEMAS (highlights the two env-encoded schemas to remove)  */
/* ------------------------------------------------------------------ */
SELECT
    N'1_schemas'                                    AS section,
    s.name                                          AS schema_name,
    p.name                                          AS principal_owner,
    CASE WHEN s.name IN (N'admin_v2', N'PACademy_staging_db')
         THEN N'ENV-ENCODED (target = collapse to dbo in a separate DB)'
         WHEN s.name = N'dbo' THEN N'dbo (canonical target schema)'
         ELSE N'' END                               AS note
FROM sys.schemas AS s
LEFT JOIN sys.database_principals AS p ON p.principal_id = s.principal_id
WHERE s.name NOT IN (N'guest', N'INFORMATION_SCHEMA', N'sys',
                     N'db_owner', N'db_accessadmin', N'db_securityadmin',
                     N'db_ddladmin', N'db_backupoperator', N'db_datareader',
                     N'db_datawriter', N'db_denydatareader', N'db_denydatawriter')
ORDER BY CASE s.name WHEN N'admin_v2' THEN 0
                     WHEN N'PACademy_staging_db' THEN 1
                     WHEN N'dbo' THEN 2 ELSE 3 END, s.name;
GO

/* ------------------------------------------------------------------ */
/* 2. PER-TABLE INVENTORY for the two legacy schemas                  */
/*    row_count  : sum of live rows from sys.dm_db_partition_stats     */
/*    column_count / fk_count / index_count : from catalog views       */
/* ------------------------------------------------------------------ */
;WITH live_rows AS (
    SELECT  ps.object_id,
            SUM(ps.row_count) AS row_count
    FROM    sys.dm_db_partition_stats AS ps
    WHERE   ps.index_id IN (0, 1)          -- heap (0) or clustered (1) only
    GROUP BY ps.object_id
)
SELECT
    N'2_tables'                                     AS section,
    sch.name                                        AS schema_name,
    t.name                                          AS table_name,
    ISNULL(lr.row_count, 0)                         AS row_count,
    (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id)
                                                    AS column_count,
    (SELECT COUNT(*) FROM sys.columns c
       WHERE c.object_id = t.object_id AND c.system_type_id = 189)
                                                    AS rowversion_col_count,  -- 189 = timestamp/rowversion
    (SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.parent_object_id = t.object_id)
                                                    AS fk_count,
    (SELECT COUNT(*) FROM sys.indexes i
       WHERE i.object_id = t.object_id AND i.type > 0)   -- exclude heaps
                                                    AS index_count,
    (SELECT COUNT(*) FROM sys.identity_columns ic WHERE ic.object_id = t.object_id)
                                                    AS identity_col_count
FROM sys.tables AS t
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
LEFT JOIN live_rows AS lr ON lr.object_id = t.object_id
WHERE sch.name IN (N'admin_v2', N'PACademy_staging_db')
ORDER BY sch.name, t.name;
GO

/* ------------------------------------------------------------------ */
/* 3. DUPLICATE TABLE NAMES present in BOTH legacy schemas            */
/*    (expected: users; possibly applicant_portal_records / exam_slots */
/*     per the AddApplicantPortal hardcoded-admin_v2 drift)            */
/* ------------------------------------------------------------------ */
;WITH live_rows AS (
    SELECT ps.object_id, SUM(ps.row_count) AS row_count
    FROM sys.dm_db_partition_stats AS ps
    WHERE ps.index_id IN (0, 1)
    GROUP BY ps.object_id
)
SELECT
    N'3_duplicate_tables'                           AS section,
    t.name                                          AS table_name,
    MAX(CASE WHEN sch.name = N'admin_v2'            THEN ISNULL(lr.row_count,0) END) AS admin_v2_rows,
    MAX(CASE WHEN sch.name = N'PACademy_staging_db' THEN ISNULL(lr.row_count,0) END) AS staging_rows,
    N'DRIFT: same table name in both schemas — canonical dbo keeps exactly one' AS note
FROM sys.tables AS t
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
LEFT JOIN live_rows AS lr ON lr.object_id = t.object_id
WHERE sch.name IN (N'admin_v2', N'PACademy_staging_db')
GROUP BY t.name
HAVING COUNT(DISTINCT sch.name) = 2
ORDER BY t.name;
GO

/* ------------------------------------------------------------------ */
/* 3b. TABLES THAT EXIST IN ONLY ONE legacy schema                   */
/*     (helps spot the AddApplicantPortal staging gap: portal tables  */
/*      may exist only under admin_v2)                                */
/* ------------------------------------------------------------------ */
SELECT
    N'3b_single_schema_tables'                      AS section,
    t.name                                          AS table_name,
    sch.name                                        AS only_in_schema,
    N'Present in just one legacy schema — verify before copy (step 03)' AS note
FROM sys.tables AS t
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
WHERE sch.name IN (N'admin_v2', N'PACademy_staging_db')
  AND t.name NOT IN (
        SELECT t2.name
        FROM sys.tables AS t2
        JOIN sys.schemas AS s2 ON s2.schema_id = t2.schema_id
        WHERE s2.name IN (N'admin_v2', N'PACademy_staging_db')
        GROUP BY t2.name
        HAVING COUNT(DISTINCT s2.name) = 2)
ORDER BY t.name, sch.name;
GO

/* ------------------------------------------------------------------ */
/* 4. FOREIGN KEYS in both legacy schemas (ordering hints for 03)     */
/* ------------------------------------------------------------------ */
SELECT
    N'4_foreign_keys'                               AS section,
    sch.name                                        AS schema_name,
    fk.name                                         AS fk_name,
    pt.name                                         AS parent_table,
    rt.name                                         AS referenced_table,
    fk.delete_referential_action_desc               AS on_delete
FROM sys.foreign_keys AS fk
JOIN sys.tables  AS pt  ON pt.object_id  = fk.parent_object_id
JOIN sys.tables  AS rt  ON rt.object_id  = fk.referenced_object_id
JOIN sys.schemas AS sch ON sch.schema_id = pt.schema_id
WHERE sch.name IN (N'admin_v2', N'PACademy_staging_db')
ORDER BY sch.name, rt.name, pt.name;
GO

/* ------------------------------------------------------------------ */
/* 5. PROGRAMMABLE OBJECTS  (views / procs / functions / triggers)    */
/*    Expected ~empty for this code-first app — any rows are drift     */
/*    the dbo rebuild does NOT reproduce automatically.                */
/* ------------------------------------------------------------------ */
SELECT N'5_views'      AS section, sch.name AS schema_name, v.name AS object_name, N'VIEW'    AS object_type
FROM sys.views AS v JOIN sys.schemas AS sch ON sch.schema_id = v.schema_id
UNION ALL
SELECT N'5_procedures', sch.name, p.name, N'PROCEDURE'
FROM sys.procedures AS p JOIN sys.schemas AS sch ON sch.schema_id = p.schema_id
UNION ALL
SELECT N'5_functions', sch.name, o.name,
       CASE o.type WHEN N'FN' THEN N'SCALAR_FN'
                   WHEN N'IF' THEN N'INLINE_TVF'
                   WHEN N'TF' THEN N'TABLE_FN' ELSE o.type END
FROM sys.objects AS o JOIN sys.schemas AS sch ON sch.schema_id = o.schema_id
WHERE o.type IN (N'FN', N'IF', N'TF')
UNION ALL
SELECT N'5_triggers', sch.name, tr.name, N'TRIGGER'
FROM sys.triggers AS tr
JOIN sys.tables  AS t   ON t.object_id  = tr.parent_id
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
WHERE tr.is_ms_shipped = 0
ORDER BY object_type, schema_name, object_name;
GO

/* ------------------------------------------------------------------ */
/* 6. EF MIGRATIONS HISTORY tables and their applied migrations       */
/*    Four contexts: __EFMigrationsHistory_AdminApi,                   */
/*    _LookupsAdmin, _ApplicantGradesAdmin, _IdentityApplicant.        */
/*    Module contexts (no HasDefaultSchema) usually land in [dbo].     */
/*    This dynamically discovers EVERY history table across ALL schemas*/
/*    and dumps its rows so you can seed step-02's history correctly.  */
/* ------------------------------------------------------------------ */

-- 6a. catalog of history tables found (any schema)
SELECT
    N'6a_history_tables'                            AS section,
    sch.name                                        AS schema_name,
    t.name                                          AS history_table,
    (SELECT COUNT(*) FROM sys.dm_db_partition_stats ps
       WHERE ps.object_id = t.object_id AND ps.index_id IN (0,1))  AS approx_row_count
FROM sys.tables AS t
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
WHERE t.name LIKE N'\_\_EFMigrationsHistory%' ESCAPE N'\'
ORDER BY sch.name, t.name;
GO

-- 6b. every applied migration row from every history table (dynamic UNION ALL)
DECLARE @historySql nvarchar(max) = N'';

SELECT @historySql = @historySql +
    CASE WHEN @historySql = N'' THEN N'' ELSE N'UNION ALL' + CHAR(10) END +
    N'SELECT N''6b_applied_migrations'' AS section, ' +
    N'N' + QUOTENAME(sch.name, N'''') + N' AS schema_name, ' +
    N'N' + QUOTENAME(t.name,   N'''') + N' AS history_table, ' +
    N'[MigrationId], [ProductVersion] FROM ' +
    QUOTENAME(sch.name) + N'.' + QUOTENAME(t.name) + CHAR(10)
FROM sys.tables AS t
JOIN sys.schemas AS sch ON sch.schema_id = t.schema_id
WHERE t.name LIKE N'\_\_EFMigrationsHistory%' ESCAPE N'\';

IF @historySql = N''
    PRINT N'No __EFMigrationsHistory* tables found in [PACademy].';
ELSE
BEGIN
    SET @historySql = @historySql + N'ORDER BY schema_name, history_table, [MigrationId];';
    EXEC sys.sp_executesql @historySql;
END
GO

PRINT N'================================================================';
PRINT N' Inventory scan complete. Capture all result grids above.';
PRINT N' Next: 01_create_databases.sql';
PRINT N'================================================================';
GO
