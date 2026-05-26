:setvar SourceSchema "admin_v2"
:setvar TargetSchema "PACademy_staging_db"

/*
    Copies all current admin data from one SQL Server schema to another schema
    in the same database.

    Intended UAT flow:
      1. Start the UAT backend once with Database__Schema=PACademy_staging_db so EF creates
         the target schema and tables through normal migrations.
      2. Stop the UAT backend.
      3. Run this script against the same database.
      4. Start the UAT backend again.

    The target schema must already have the same table structure. Rowversion
    columns are intentionally excluded because SQL Server generates them.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @sourceSchema sysname = N'$(SourceSchema)';
DECLARE @targetSchema sysname = N'$(TargetSchema)';
DECLARE @sql nvarchar(max) = N'';

IF SCHEMA_ID(@sourceSchema) IS NULL
    THROW 51000, 'Source schema does not exist.', 1;

IF SCHEMA_ID(@targetSchema) IS NULL
    THROW 51001, 'Target schema does not exist. Run backend migrations for the UAT schema first.', 1;

DECLARE @tables TABLE
(
    table_name sysname NOT NULL,
    ordinal int IDENTITY(1,1) NOT NULL
);

INSERT INTO @tables (table_name)
SELECT source_table.name
FROM sys.tables AS source_table
INNER JOIN sys.schemas AS source_schema ON source_schema.schema_id = source_table.schema_id
INNER JOIN sys.tables AS target_table ON target_table.name = source_table.name
INNER JOIN sys.schemas AS target_schema ON target_schema.schema_id = target_table.schema_id
WHERE source_schema.name = @sourceSchema
  AND target_schema.name = @targetSchema
  AND source_table.name <> N'__EFMigrationsHistory_AdminApi'
ORDER BY source_table.name;

BEGIN TRANSACTION;

SELECT @sql += N'DELETE FROM ' + QUOTENAME(@targetSchema) + N'.' + QUOTENAME(table_name) + N';' + CHAR(10)
FROM @tables
ORDER BY ordinal DESC;

EXEC sys.sp_executesql @sql;

DECLARE @tableName sysname;
DECLARE copy_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT table_name FROM @tables ORDER BY ordinal;

OPEN copy_cursor;
FETCH NEXT FROM copy_cursor INTO @tableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @columns nvarchar(max);

    SELECT @columns = STRING_AGG(QUOTENAME(c.name), N', ') WITHIN GROUP (ORDER BY c.column_id)
    FROM sys.columns AS c
    INNER JOIN sys.tables AS t ON t.object_id = c.object_id
    INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    WHERE s.name = @sourceSchema
      AND t.name = @tableName
      AND c.is_computed = 0
      AND c.system_type_id <> 189;

    SET @sql = N'INSERT INTO ' + QUOTENAME(@targetSchema) + N'.' + QUOTENAME(@tableName) +
        N' (' + @columns + N') SELECT ' + @columns +
        N' FROM ' + QUOTENAME(@sourceSchema) + N'.' + QUOTENAME(@tableName) + N';';

    EXEC sys.sp_executesql @sql;
    PRINT N'Copied ' + @tableName;

    FETCH NEXT FROM copy_cursor INTO @tableName;
END

CLOSE copy_cursor;
DEALLOCATE copy_cursor;

COMMIT TRANSACTION;

PRINT N'UAT schema data copy complete.';
