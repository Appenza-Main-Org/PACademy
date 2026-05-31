/* ============================================================================
   04_sync_lookup_config.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Bring the LOOKUP + CONFIGURATION + IDENTITY/PERMISSION tables to IDENTICAL
     content across the two target databases, with [DB_PAcademy_Prod].dbo as the
     single SOURCE OF TRUTH and [DB_PAcademy_Staging].dbo as the destination.
     Per the seed inventory, these classes "must be identical Prod==Staging;
     only transactional volume may differ". The transactional tables are
     intentionally NOT touched here.

     For each table in the curated set this script generates and runs a dynamic
     MERGE by PRIMARY KEY:
        - INSERT rows missing from staging,
        - UPDATE rows whose non-rowversion columns differ,
        - DELETE rows that exist in staging but not in prod  (COMMENTED OUT by
          default — uncomment the @AllowDelete switch to enable).
     ROWVERSION columns (system_type_id = 189) are excluded from the UPDATE SET
     and from change detection (they regenerate per-DB and would force endless
     false updates). The PK column(s) are discovered from the target's primary
     key, so the MERGE join is always correct.

     A per-table summary (inserted / updated / deleted) is printed and also
     collected into a final result grid.

     SAFE TO RE-RUN — MERGE is convergent and idempotent: a second run with no
     prod changes reports 0/0/0 for every table.

   ----------------------------------------------------------------------------
   CURATED TABLE SET  (classification from the seed inventory)
     LOOKUP (must be identical):
       lookup_rows                                  (25 keys / ~427 rows)
       faculties                                    (standalone LookupsAdmin table, 18 rows)
     CONFIGURATION (must be identical):
       applicant_categories
       admission_cycles
       admission_rules
       application_settings_category_configs
       application_settings_category_specializations
       application_settings_graduation_years
       general_settings                             (1-row singleton; see note)
       exams                                        (Question Bank blueprint)
       exam_rules
       exam_question_links
       exam_questions                               (catalog, 52 rows)
       exam_question_options
       exam_question_matching_pairs
     IDENTITY / PERMISSIONS (must be identical):
       roles                                        (8 cloud roles + permissions)
     NOTE — officer_directory and users are identity tables, BUT they also
     carry operational admin-created rows that live only in prod and must be
     carried over by the 03 copy, not forced equal here. They are deliberately
     LEFT OUT of this sync so staging-created test users are not clobbered and
     prod operational users are not pushed to staging. Adjust the list below if
     your policy is full identity parity.
     NOTE — general_settings is a lazily-created singleton (Id='settings'); if
     prod has no row yet, the MERGE is a no-op (nothing to push). Ensure the
     general_settings TABLE exists on staging (migration 20260530114800) before
     running — step 02 guarantees this.

   PREREQUISITES
     - 01, 02, 03 complete for BOTH target DBs (structures + data loaded).
     - Both target DBs on the SAME server (3-part names used throughout).
     - Login has SELECT on prod target + INSERT/UPDATE/DELETE on staging target.
     - **REQUIRES A FULL BACKUP FIRST** of [DB_PAcademy_Staging].

   RUN ORDER
         00 -> 01 -> 02 -> 03 (prod) -> 03 (staging) ->
     >>> 04_sync_lookup_config.sql   <-- YOU ARE HERE
         05 -> 06
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ==========================  PARAMETERS  ============================== */
DECLARE @SourceDb   sysname = N'DB_PAcademy_Prod';      -- source of truth
DECLARE @TargetDb   sysname = N'DB_PAcademy_Staging';   -- brought into line
DECLARE @Schema     sysname = N'dbo';
DECLARE @AllowDelete bit    = 0;   -- 0 = keep staging-extra rows; 1 = DELETE rows not in prod
/* ===================================================================== */

IF DB_ID(@SourceDb) IS NULL BEGIN RAISERROR(N'Source DB [%s] not found.',16,1,@SourceDb); RETURN; END
IF DB_ID(@TargetDb) IS NULL BEGIN RAISERROR(N'Target DB [%s] not found.',16,1,@TargetDb); RETURN; END

/* Curated set (order chosen so FK parents land before children for the
   ON DELETE CASCADE chains: exam_questions before its option/pair children,
   exams before rules/links). Order is harmless for INSERT/UPDATE-only runs. */
DECLARE @set TABLE (ordinal int IDENTITY(1,1), table_name sysname);
INSERT INTO @set (table_name) VALUES
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

PRINT N'================================================================';
PRINT N' Lookup / config / identity sync';
PRINT N'   source of truth : [' + @SourceDb + N'].[' + @Schema + N']';
PRINT N'   destination     : [' + @TargetDb + N'].[' + @Schema + N']';
PRINT N'   delete-extra    : ' + CASE WHEN @AllowDelete = 1 THEN N'ENABLED' ELSE N'disabled (default)' END;
PRINT N'================================================================';

/* Results accumulator for the closing summary grid. */
DECLARE @summary TABLE (table_name sysname, inserted int, updated int, deleted int, note nvarchar(256));

DECLARE @t sysname, @sql nvarchar(max), @msg nvarchar(2048);
DECLARE @pkCols nvarchar(max), @allCols nvarchar(max), @nonPkNonRv nvarchar(max);
DECLARE @onClause nvarchar(max), @updSet nvarchar(max), @insCols nvarchar(max), @insVals nvarchar(max);
DECLARE @changeCmp nvarchar(max);
DECLARE @ins int, @upd int, @del int;

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT table_name FROM @set ORDER BY ordinal;
OPEN c; FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        /* Skip tables not present in BOTH target DBs (drift-safe). */
        DECLARE @existsBoth bit = 0;
        SET @sql = N'
            SELECT @e = CASE WHEN
                EXISTS (SELECT 1 FROM [' + @SourceDb + N'].sys.tables tt
                        JOIN [' + @SourceDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
                        WHERE ts.name=@sch AND tt.name=@tbl)
            AND EXISTS (SELECT 1 FROM [' + @TargetDb + N'].sys.tables tt
                        JOIN [' + @TargetDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
                        WHERE ts.name=@sch AND tt.name=@tbl)
            THEN 1 ELSE 0 END;';
        EXEC sys.sp_executesql @sql, N'@e bit OUTPUT, @sch sysname, @tbl sysname',
             @e=@existsBoth OUTPUT, @sch=@Schema, @tbl=@t;

        IF @existsBoth = 0
        BEGIN
            INSERT INTO @summary VALUES (@t, NULL, NULL, NULL, N'SKIPPED — table missing in one DB');
            PRINT N'  ' + @t + N': SKIPPED (missing in one DB)';
            FETCH NEXT FROM c INTO @t; CONTINUE;
        END

        /* ---- discover PK columns (from the TARGET pk) ---- */
        SET @pkCols = NULL;
        SET @sql = N'
            SELECT @pk = STRING_AGG(QUOTENAME(col.name), N'','') WITHIN GROUP (ORDER BY ic.key_ordinal)
            FROM [' + @TargetDb + N'].sys.indexes i
            JOIN [' + @TargetDb + N'].sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
            JOIN [' + @TargetDb + N'].sys.columns col ON col.object_id=ic.object_id AND col.column_id=ic.column_id
            JOIN [' + @TargetDb + N'].sys.tables tt ON tt.object_id=i.object_id
            JOIN [' + @TargetDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
            WHERE i.is_primary_key=1 AND ts.name=@sch AND tt.name=@tbl;';
        EXEC sys.sp_executesql @sql, N'@pk nvarchar(max) OUTPUT, @sch sysname, @tbl sysname',
             @pk=@pkCols OUTPUT, @sch=@Schema, @tbl=@t;

        IF @pkCols IS NULL
        BEGIN
            INSERT INTO @summary VALUES (@t, NULL, NULL, NULL, N'SKIPPED — no primary key, cannot MERGE');
            PRINT N'  ' + @t + N': SKIPPED (no PK)';
            FETCH NEXT FROM c INTO @t; CONTINUE;
        END

        /* ---- column buckets (all insertable, and non-PK non-rowversion) ---- */
        /* All insertable columns (exclude computed + rowversion). Build the
           INSERT column list (@allCols) AND the matching src-prefixed VALUES
           list (@insVals) in the SAME pass / SAME column_id order, so the two
           are guaranteed aligned (STRING_SPLIT order is not contractual, so we
           never round-trip @allCols through it to derive the VALUES list).      */
        SET @allCols = NULL;
        SET @insVals = NULL;
        SET @sql = N'
            SELECT @cl = STRING_AGG(QUOTENAME(c.name), N'', '') WITHIN GROUP (ORDER BY c.column_id),
                   @iv = STRING_AGG(N''src.'' + QUOTENAME(c.name), N'', '') WITHIN GROUP (ORDER BY c.column_id)
            FROM [' + @TargetDb + N'].sys.columns c
            JOIN [' + @TargetDb + N'].sys.tables tt ON tt.object_id=c.object_id
            JOIN [' + @TargetDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
            WHERE ts.name=@sch AND tt.name=@tbl AND c.is_computed=0 AND c.system_type_id<>189;';
        EXEC sys.sp_executesql @sql,
             N'@cl nvarchar(max) OUTPUT, @iv nvarchar(max) OUTPUT, @sch sysname, @tbl sysname',
             @cl=@allCols OUTPUT, @iv=@insVals OUTPUT, @sch=@Schema, @tbl=@t;

        /* Non-PK, non-rowversion, non-computed columns -> drive UPDATE SET +
           change detection. (PK never updated; rowversion never copied.)      */
        SET @nonPkNonRv = NULL;
        SET @sql = N'
            SELECT @cl = STRING_AGG(QUOTENAME(c.name), N'', '') WITHIN GROUP (ORDER BY c.column_id)
            FROM [' + @TargetDb + N'].sys.columns c
            JOIN [' + @TargetDb + N'].sys.tables tt ON tt.object_id=c.object_id
            JOIN [' + @TargetDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
            WHERE ts.name=@sch AND tt.name=@tbl
              AND c.is_computed=0 AND c.system_type_id<>189
              AND NOT EXISTS (
                  SELECT 1
                  FROM [' + @TargetDb + N'].sys.indexes i
                  JOIN [' + @TargetDb + N'].sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
                  WHERE i.is_primary_key=1 AND ic.object_id=c.object_id AND ic.column_id=c.column_id);';
        EXEC sys.sp_executesql @sql, N'@cl nvarchar(max) OUTPUT, @sch sysname, @tbl sysname',
             @cl=@nonPkNonRv OUTPUT, @sch=@Schema, @tbl=@t;

        /* ---- assemble MERGE fragments ----
           All column lists are built as ", "-delimited QUOTENAME() identifiers.
           STRING_SPLIT takes a SINGLE-character separator (',') and we LTRIM/RTRIM
           each piece so the leading space after the comma never leaks into the
           generated SQL (correctness for composite PKs + multi-column tables).   */
        -- ON src.pk = tgt.pk  (handles composite PKs)
        SELECT @onClause = STRING_AGG(N'tgt.' + LTRIM(RTRIM(value)) + N' = src.' + LTRIM(RTRIM(value)), N' AND ')
        FROM STRING_SPLIT(@pkCols, N',');

        -- INSERT (cols) VALUES (src.cols).  @insCols + @insVals were built together
        -- above in matching column_id order; just alias the column list here.
        SET @insCols = @allCols;

        IF @nonPkNonRv IS NULL
        BEGIN
            -- PK-only table (e.g. pure link/junction with no payload): no UPDATE
            -- branch possible/necessary — rows are either present or inserted.
            SET @updSet    = NULL;
            SET @changeCmp = NULL;
        END
        ELSE
        BEGIN
            -- UPDATE SET col = src.col  for every non-PK non-rowversion column
            SELECT @updSet = STRING_AGG(LTRIM(RTRIM(value)) + N' = src.' + LTRIM(RTRIM(value)), N', ')
            FROM STRING_SPLIT(@nonPkNonRv, N',');

            -- change detection: NULL-safe inequality across the same columns,
            -- so unchanged rows are NOT needlessly rewritten.
            SELECT @changeCmp = STRING_AGG(
                       N'EXISTS (SELECT src.' + LTRIM(RTRIM(value)) + N' EXCEPT SELECT tgt.' + LTRIM(RTRIM(value)) + N')',
                       N' OR ')
            FROM STRING_SPLIT(@nonPkNonRv, N',');
        END

        /* ---- run the MERGE, capturing $action counts via OUTPUT ---- */
        SET @ins = 0; SET @upd = 0; SET @del = 0;

        SET @sql =
            N'DECLARE @act TABLE (a nvarchar(10));' + CHAR(10) +
            N'MERGE [' + @TargetDb + N'].[' + @Schema + N'].' + QUOTENAME(@t) + N' AS tgt' + CHAR(10) +
            N'USING [' + @SourceDb + N'].[' + @Schema + N'].' + QUOTENAME(@t) + N' AS src' + CHAR(10) +
            N'    ON ' + @onClause + CHAR(10) +
            CASE WHEN @updSet IS NOT NULL THEN
                N'WHEN MATCHED AND (' + @changeCmp + N') THEN UPDATE SET ' + @updSet + CHAR(10)
            ELSE N'' END +
            N'WHEN NOT MATCHED BY TARGET THEN INSERT (' + @insCols + N') VALUES (' + @insVals + N')' + CHAR(10) +
            CASE WHEN @AllowDelete = 1 THEN
                N'WHEN NOT MATCHED BY SOURCE THEN DELETE' + CHAR(10)
            ELSE
                N'/* DELETE branch disabled (@AllowDelete=0): staging-extra rows kept */' + CHAR(10)
            END +
            N'OUTPUT $action INTO @act;' + CHAR(10) +
            N'SELECT @i = SUM(CASE WHEN a=N''INSERT'' THEN 1 ELSE 0 END),' + CHAR(10) +
            N'       @u = SUM(CASE WHEN a=N''UPDATE'' THEN 1 ELSE 0 END),' + CHAR(10) +
            N'       @d = SUM(CASE WHEN a=N''DELETE'' THEN 1 ELSE 0 END)' + CHAR(10) +
            N'FROM @act;';

        EXEC sys.sp_executesql @sql,
             N'@i int OUTPUT, @u int OUTPUT, @d int OUTPUT',
             @i=@ins OUTPUT, @u=@upd OUTPUT, @d=@del OUTPUT;

        SET @ins = ISNULL(@ins,0); SET @upd = ISNULL(@upd,0); SET @del = ISNULL(@del,0);
        INSERT INTO @summary VALUES (@t, @ins, @upd, @del,
            CASE WHEN @updSet IS NULL THEN N'PK-only (insert/delete only)' ELSE N'OK' END);

        SET @msg = N'  ' + @t + N':  +' + CAST(@ins AS nvarchar(10))
                 + N'  ~' + CAST(@upd AS nvarchar(10))
                 + N'  -' + CAST(@del AS nvarchar(10));
        PRINT @msg;
    END TRY
    BEGIN CATCH
        SET @msg = N'FAILED on table [' + @t + N']: ' + ERROR_MESSAGE();
        INSERT INTO @summary VALUES (@t, NULL, NULL, NULL, N'ERROR: ' + ERROR_MESSAGE());
        PRINT @msg;
        ;THROW;
    END CATCH;

    FETCH NEXT FROM c INTO @t;
END
CLOSE c; DEALLOCATE c;

/* ------------------------------------------------------------------ */
/* FINAL SUMMARY GRID                                                  */
/* ------------------------------------------------------------------ */
SELECT
    N'sync_summary'      AS section,
    table_name,
    inserted,
    updated,
    deleted,
    note
FROM @summary
ORDER BY table_name;

PRINT N'================================================================';
PRINT N' Lookup / config / identity sync complete.';
PRINT N' Next: 05_validate.sql';
PRINT N'================================================================';
GO
