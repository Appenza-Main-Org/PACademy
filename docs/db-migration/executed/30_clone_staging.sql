/* Clone DB_PAcademy_Prod.dbo -> DB_PAcademy_Staging.dbo (staging = synchronized
   copy of production). Every base dbo table except the EF history tables (already
   built+seeded in staging). rowversion/computed excluded; FKs disabled then rechecked. */
SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @SourceDb sysname = N'DB_PAcademy_Prod';
DECLARE @TargetDb sysname = N'DB_PAcademy_Staging';
DECLARE @TS sysname = N'dbo';
DECLARE @sql nvarchar(max), @t sysname, @cl nvarchar(max), @rows bigint;

DECLARE @work TABLE (ord int IDENTITY(1,1), tbl sysname);
INSERT INTO @work (tbl)
  SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
  WHERE s.name=@TS AND t.name NOT LIKE N'\_\_EFMigrationsHistory%' ESCAPE N'\'
  ORDER BY t.name;

/* disable FK on target */
DECLARE c1 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @work ORDER BY ord;
OPEN c1; FETCH NEXT FROM c1 INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[dbo].' + QUOTENAME(@t) + N' NOCHECK CONSTRAINT ALL;'; EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM c1 INTO @t;
END
CLOSE c1; DEALLOCATE c1;

/* copy */
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @work ORDER BY ord;
OPEN c2; FETCH NEXT FROM c2 INTO @t;
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
                    WHERE ss.name=@ts AND st.name=@tb AND sc.name=tc.name)';
    EXEC sys.sp_executesql @sql, N'@o nvarchar(max) OUTPUT,@ts sysname,@tb sysname,@sep nvarchar(4)',
         @o=@cl OUTPUT, @ts=@TS, @tb=@t, @sep=N', ';
    IF @cl IS NULL BEGIN PRINT N'  ' + @t + N': no cols — skip'; FETCH NEXT FROM c2 INTO @t; CONTINUE; END
    SET @sql = N'INSERT INTO ' + QUOTENAME(@TargetDb) + N'.[dbo].' + QUOTENAME(@t) + N' (' + @cl + N') SELECT ' + @cl
             + N' FROM ' + QUOTENAME(@SourceDb) + N'.[dbo].' + QUOTENAME(@t) + N';';
    EXEC sys.sp_executesql @sql; SET @rows=@@ROWCOUNT;
    PRINT N'  cloned dbo.' + @t + N'  (' + CAST(@rows AS nvarchar(20)) + N' rows)';
  END TRY BEGIN CATCH
    PRINT N'  !! FAILED ' + @t + N': ' + ERROR_MESSAGE();
  END CATCH
  FETCH NEXT FROM c2 INTO @t;
END
CLOSE c2; DEALLOCATE c2;

/* re-enable FK */
DECLARE c3 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @work ORDER BY ord;
OPEN c3; FETCH NEXT FROM c3 INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  BEGIN TRY SET @sql = N'ALTER TABLE [' + @TargetDb + N'].[dbo].' + QUOTENAME(@t) + N' WITH CHECK CHECK CONSTRAINT ALL;'; EXEC sys.sp_executesql @sql;
  END TRY BEGIN CATCH PRINT N'  FK recheck failed on ' + @t + N': ' + ERROR_MESSAGE(); END CATCH
  FETCH NEXT FROM c3 INTO @t;
END
CLOSE c3; DEALLOCATE c3;
PRINT N'-- staging clone done';
