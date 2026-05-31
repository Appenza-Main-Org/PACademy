/* Load DB_PAcademy_Prod.dbo from the drifted [PACademy] schemas via an explicit
   per-table canonical-source map (resolves the admin_v2 / dbo / staging drift).
   rowversion + computed cols excluded; source∩target column intersect (drift-safe).
   FKs disabled during load, re-checked after. [PACademy] is only READ. */
SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @SourceDb sysname = N'PACademy';
DECLARE @TargetDb sysname = N'DB_PAcademy_Prod';
DECLARE @TS sysname = N'dbo';
DECLARE @sql nvarchar(max), @t sysname, @src sysname, @cl nvarchar(max), @rows bigint;

DECLARE @map TABLE (ord int IDENTITY(1,1), srcSchema sysname, tbl sysname);
INSERT INTO @map (srcSchema, tbl) VALUES
 (N'admin_v2', N'admin_records'),
 (N'admin_v2', N'admission_cycles'),
 (N'admin_v2', N'admission_rules'),
 (N'admin_v2', N'applicant_categories'),
 (N'admin_v2', N'applicant_grade_adjustments'),
 (N'admin_v2', N'applicant_grades'),
 (N'admin_v2', N'applicant_portal_records'),
 (N'admin_v2', N'application_settings_category_configs'),
 (N'admin_v2', N'application_settings_category_specializations'),
 (N'admin_v2', N'application_settings_graduation_years'),
 (N'admin_v2', N'audit_entries'),
 (N'admin_v2', N'exam_slots'),
 (N'admin_v2', N'lookup_rows'),
 (N'admin_v2', N'officer_directory'),
 (N'admin_v2', N'roles'),
 (N'admin_v2', N'users'),
 (N'dbo', N'applicants'),
 (N'dbo', N'faculties'),
 (N'dbo', N'grade_import_batches'),
 (N'dbo', N'grade_import_rows'),
 (N'PACademy_staging_db', N'exams'),
 (N'PACademy_staging_db', N'exam_questions'),
 (N'PACademy_staging_db', N'exam_question_options'),
 (N'PACademy_staging_db', N'exam_question_matching_pairs'),
 (N'PACademy_staging_db', N'exam_rules'),
 (N'PACademy_staging_db', N'exam_question_links'),
 (N'PACademy_staging_db', N'exam_assignments'),
 (N'PACademy_staging_db', N'general_settings');

/* disable all FK on target */
DECLARE c1 CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@TS;
OPEN c1; FETCH NEXT FROM c1 INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[dbo].' + QUOTENAME(@t) + N' NOCHECK CONSTRAINT ALL;'; EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM c1 INTO @t;
END
CLOSE c1; DEALLOCATE c1;

/* copy per map */
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR SELECT srcSchema, tbl FROM @map ORDER BY ord;
OPEN c2; FETCH NEXT FROM c2 INTO @src, @t;
WHILE @@FETCH_STATUS=0 BEGIN
  BEGIN TRY
    SET @cl = NULL;
    SET @sql = N'SELECT @o = STRING_AGG(QUOTENAME(tc.name), @sep) WITHIN GROUP (ORDER BY tc.column_id)
      FROM [' + @TargetDb + N'].sys.columns tc
      JOIN [' + @TargetDb + N'].sys.tables tt ON tt.object_id=tc.object_id
      JOIN [' + @TargetDb + N'].sys.schemas ts ON ts.schema_id=tt.schema_id
      WHERE ts.name=@ts AND tt.name=@tb AND tc.is_computed=0 AND tc.system_type_id<>189
        AND EXISTS (SELECT 1 FROM [' + @SourceDb + N'].sys.columns sc
                    JOIN [' + @SourceDb + N'].sys.tables st ON st.object_id=sc.object_id
                    JOIN [' + @SourceDb + N'].sys.schemas ss ON ss.schema_id=st.schema_id
                    WHERE ss.name=@sc AND st.name=@tb AND sc.name=tc.name)';
    EXEC sys.sp_executesql @sql,
         N'@o nvarchar(max) OUTPUT,@ts sysname,@tb sysname,@sc sysname,@sep nvarchar(4)',
         @o=@cl OUTPUT, @ts=@TS, @tb=@t, @sc=@src, @sep=N', ';
    IF @cl IS NULL BEGIN PRINT N'  ' + @t + N': no common cols — skip'; FETCH NEXT FROM c2 INTO @src,@t; CONTINUE; END
    SET @sql = N'INSERT INTO ' + QUOTENAME(@TargetDb) + N'.[dbo].' + QUOTENAME(@t) + N' (' + @cl + N') SELECT ' + @cl
             + N' FROM ' + QUOTENAME(@SourceDb) + N'.' + QUOTENAME(@src) + N'.' + QUOTENAME(@t) + N';';
    EXEC sys.sp_executesql @sql; SET @rows=@@ROWCOUNT;
    PRINT N'  copied [' + @src + N'].' + @t + N' -> dbo.' + @t + N'  (' + CAST(@rows AS nvarchar(20)) + N' rows)';
  END TRY BEGIN CATCH
    PRINT N'  !! FAILED ' + @t + N' from [' + @src + N']: ' + ERROR_MESSAGE();
  END CATCH
  FETCH NEXT FROM c2 INTO @src, @t;
END
CLOSE c2; DEALLOCATE c2;

/* re-enable + validate FKs */
DECLARE c3 CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@TS;
OPEN c3; FETCH NEXT FROM c3 INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  BEGIN TRY SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[dbo].' + QUOTENAME(@t) + N' WITH CHECK CHECK CONSTRAINT ALL;'; EXEC sys.sp_executesql @sql;
  END TRY BEGIN CATCH PRINT N'  FK recheck failed on ' + @t + N': ' + ERROR_MESSAGE(); END CATCH
  FETCH NEXT FROM c3 INTO @t;
END
CLOSE c3; DEALLOCATE c3;
PRINT N'-- prod load done';
