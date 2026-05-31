SET NOCOUNT ON;
DECLARE @dir nvarchar(512);
BEGIN TRY
  EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE',
       N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', @dir OUTPUT;
END TRY BEGIN CATCH SET @dir = NULL; END CATCH;
IF @dir IS NULL OR LEN(@dir) = 0
  SET @dir = N'C:\Program Files\Microsoft SQL Server\MSSQL14.MSSQLSERVER\MSSQL\Backup';
DECLARE @path nvarchar(700) = @dir + N'\PACademy_premigration_20260531.bak';
DECLARE @sql nvarchar(max) =
  N'BACKUP DATABASE [PACademy] TO DISK=N''' + REPLACE(@path,'''','''''') +
  N''' WITH COPY_ONLY, INIT, CHECKSUM, STATS=10;';
PRINT N'Backup target: ' + @path;
EXEC (@sql);
PRINT N'Verifying...';
DECLARE @v nvarchar(max) = N'RESTORE VERIFYONLY FROM DISK=N''' + REPLACE(@path,'''','''''') + N''' WITH CHECKSUM;';
EXEC (@v);
SELECT @path AS backup_path, N'OK (verified)' AS status;
