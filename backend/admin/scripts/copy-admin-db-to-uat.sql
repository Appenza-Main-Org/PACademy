:setvar SourceDb "PACademy_Admin"
:setvar TargetDb "PACademy_Admin_UAT"
:setvar BackupPath "/tmp/PACademy_Admin_UAT_COPY.bak"
:setvar SourceLogicalDataName "PACademy_Admin"
:setvar SourceLogicalLogName "PACademy_Admin_log"
:setvar TargetDataFile "/var/opt/mssql/data/PACademy_Admin_UAT.mdf"
:setvar TargetLogFile "/var/opt/mssql/data/PACademy_Admin_UAT_log.ldf"

/*
    Copies the current admin SQL Server database to a UAT database.

    This is intentionally backup/restore instead of table-by-table INSERTs:
    it preserves the current schema, EF migration history, constraints, indexes,
    rowversion columns, and all data exactly as SQL Server stores them.

    Before first run, confirm logical file names:

      BACKUP DATABASE [PACademy_Admin]
        TO DISK = N'/tmp/PACademy_Admin_FILELIST.bak'
        WITH COPY_ONLY, INIT, COMPRESSION, CHECKSUM;
      RESTORE FILELISTONLY FROM DISK = N'/tmp/PACademy_Admin_FILELIST.bak';

    Then pass the returned LogicalName values as SourceLogicalDataName and
    SourceLogicalLogName if they differ from the defaults above.
*/

PRINT N'Creating COPY_ONLY backup from $(SourceDb)...';
BACKUP DATABASE [$(SourceDb)]
    TO DISK = N'$(BackupPath)'
    WITH COPY_ONLY, INIT, COMPRESSION, CHECKSUM, STATS = 10;

IF DB_ID(N'$(TargetDb)') IS NOT NULL
BEGIN
    PRINT N'Dropping existing target database $(TargetDb)...';
    ALTER DATABASE [$(TargetDb)] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$(TargetDb)];
END

PRINT N'Restoring backup into $(TargetDb)...';
RESTORE DATABASE [$(TargetDb)]
    FROM DISK = N'$(BackupPath)'
    WITH
        MOVE N'$(SourceLogicalDataName)' TO N'$(TargetDataFile)',
        MOVE N'$(SourceLogicalLogName)' TO N'$(TargetLogFile)',
        REPLACE,
        RECOVERY,
        CHECKSUM,
        STATS = 10;

ALTER DATABASE [$(TargetDb)] SET MULTI_USER;

PRINT N'UAT database copy complete.';
