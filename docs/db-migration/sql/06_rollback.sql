/* ============================================================================
   06_rollback.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Safe rollback of the environment-separation migration. The migration is
     ADDITIVE: it creates two BRAND-NEW databases ([DB_PAcademy_Prod],
     [DB_PAcademy_Staging]) and NEVER alters the legacy [PACademy] database or
     its [admin_v2] / [PACademy_staging_db] schemas. Therefore rollback is:

       (a) REPOINT the Railway service env vars back to the legacy topology
           (documented below — no SQL required), and
       (b) OPTIONALLY drop the two new databases to reclaim space.

     [PACademy] is the system of record throughout the cutover and is NEVER
     touched by this script. There is a hard guard preventing it from being
     dropped.

     Part (b) is gated behind @Confirm: it does NOTHING unless you explicitly
     set @Confirm = N'YES-DROP'. With the default value the script only prints
     what it WOULD do.

   ----------------------------------------------------------------------------
   (a) RAILWAY ROLLBACK — repoint env vars to the legacy schema-in-one-DB setup
       (Railway project "PA Academy Project", id eadfbf1c-8500-49cb-a53b-0824cdaf72df).
       Restore these per-service variables to their pre-migration values
       (passwords come from the Railway secret, shown here as <from-railway-secret>):

       pacademy-admin-prod-api
         ASPNETCORE_ENVIRONMENT       = Production
         Database__Schema             = admin_v2
         Database__ActiveConnectionName = AdminDb
         ConnectionStrings__AdminDb   = Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;
         SkipMigrationsAndSeed        = true

       pacademy-admin-staging-api
         ASPNETCORE_ENVIRONMENT       = Uat
         Database__Schema             = PACademy_staging_db
         Database__ActiveConnectionName = AdminDbUat
         ConnectionStrings__AdminDbUat = Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;
         SkipMigrationsAndSeed        = true

       pacademy-applicant-prod-api
         ASPNETCORE_ENVIRONMENT       = Production
         Database__Schema             = admin_v2
         Database__ActiveConnectionName = AdminDb
         ConnectionStrings__AdminDb   = Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;
         (applicant reads ConnectionStrings:Default — set ConnectionStrings__Default to the
          same PACademy connection string the legacy deployment used)
         SkipMigrationsAndSeed        = false

       pacademy-applicant-staging-api
         ASPNETCORE_ENVIRONMENT       = Production
         Database__Schema             = PACademy_staging_db
         Database__ActiveConnectionName = AdminDb
         ConnectionStrings__AdminDb   = Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;
         (and ConnectionStrings__Default -> the PACademy staging connection string)
         SkipMigrationsAndSeed        = true

       After repointing, redeploy each service. Because [PACademy] was never
       modified, the services resume exactly as before the migration.

       NOTE: if the code branch has already been changed to default
       AdminDbContext.DefaultSchema = "dbo" and to drop the Database__Schema
       overrides, you must ALSO redeploy the PRE-migration commit (or restore
       the Database__Schema=admin_v2 / PACademy_staging_db overrides above) so
       EF resolves the old schemas again. Repointing env vars alone is enough
       ONLY while the legacy schema overrides are still honored by the code.

   ----------------------------------------------------------------------------
   (b) DROP the new databases — guarded. Run ONLY after (a) is verified and
       traffic is back on [PACademy]. Sets each DB to SINGLE_USER WITH ROLLBACK
       IMMEDIATE to evict connections, then DROPs it.

   PREREQUISITES
     - You have decided to abandon the migration and traffic is (or will be)
       restored to [PACademy] via part (a).
     - **REQUIRES A FULL BACKUP FIRST** — before dropping the new DBs, back them
       up if there is ANY chance you will need the migrated/synced data again
       (e.g. a partially validated staging copy). Dropping is irreversible.

   RUN ORDER
     This file is OUT OF BAND — run it only if backing out. It is the last file
     in the set (00 -> 01 -> 02 -> 03 -> 04 -> 05, then 06 only on rollback).

   INVOCATION
     Edit @Confirm to N'YES-DROP' to actually drop. Leave it as N'NO' for a
     dry run that only prints intended actions.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ==========================  PARAMETERS  ============================== */
DECLARE @Confirm  nvarchar(16) = N'NO';   -- set to N'YES-DROP' to execute the DROPs
/* ===================================================================== */

DECLARE @drop TABLE (ordinal int IDENTITY(1,1), db_name sysname);
INSERT INTO @drop (db_name) VALUES (N'DB_PAcademy_Prod'), (N'DB_PAcademy_Staging');

/* Hard safety: the legacy system-of-record must never be a drop target. */
IF EXISTS (SELECT 1 FROM @drop WHERE db_name = N'PACademy')
BEGIN
    RAISERROR(N'SAFETY ABORT: [PACademy] must never be dropped by this script.', 16, 1);
    RETURN;
END

PRINT N'================================================================';
PRINT N' Rollback — drop new databases';
PRINT N'   confirm switch : ' + @Confirm
      + CASE WHEN @Confirm = N'YES-DROP' THEN N'  (DROPS WILL EXECUTE)'
                                         ELSE N'  (dry run — nothing dropped)' END;
PRINT N'   protected      : [PACademy] (never dropped)';
PRINT N'================================================================';

DECLARE @db sysname, @sql nvarchar(max), @msg nvarchar(2048);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT db_name FROM @drop ORDER BY ordinal;
OPEN c; FETCH NEXT FROM c INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    /* Re-assert the guard inside the loop in case the list was edited. */
    IF @db = N'PACademy'
    BEGIN
        PRINT N'  REFUSING to drop [PACademy] (protected).';
        FETCH NEXT FROM c INTO @db; CONTINUE;
    END

    IF DB_ID(@db) IS NULL
    BEGIN
        PRINT N'  [' + @db + N'] does not exist — nothing to drop.';
        FETCH NEXT FROM c INTO @db; CONTINUE;
    END

    IF @Confirm <> N'YES-DROP'
    BEGIN
        SET @msg = N'  DRY RUN: would set [' + @db
                 + N'] to SINGLE_USER WITH ROLLBACK IMMEDIATE and DROP it.';
        PRINT @msg;
        FETCH NEXT FROM c INTO @db; CONTINUE;
    END

    /* Confirmed drop path. */
    BEGIN TRY
        SET @msg = N'  Dropping [' + @db + N']...';
        PRINT @msg;

        SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db)
                 + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
        EXEC sys.sp_executesql @sql;

        SET @sql = N'DROP DATABASE ' + QUOTENAME(@db) + N';';
        EXEC sys.sp_executesql @sql;

        PRINT N'  Dropped [' + @db + N'].';
    END TRY
    BEGIN CATCH
        /* If the DROP failed, try to leave the DB MULTI_USER again so it is
           not stranded in SINGLE_USER. */
        BEGIN TRY
            IF DB_ID(@db) IS NOT NULL
                EXEC sys.sp_executesql (N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET MULTI_USER;');
        END TRY BEGIN CATCH /* swallow */ END CATCH;

        SET @msg = N'  FAILED to drop [' + @db + N']: ' + ERROR_MESSAGE();
        PRINT @msg;
        ;THROW;
    END CATCH;

    FETCH NEXT FROM c INTO @db;
END
CLOSE c; DEALLOCATE c;

PRINT N'================================================================';
IF @Confirm = N'YES-DROP'
    PRINT N' Rollback DROP phase complete. Confirm Railway part (a) is done.';
ELSE
    PRINT N' Dry run only. Set @Confirm = N''YES-DROP'' to actually drop.';
PRINT N' [PACademy] was not touched.';
PRINT N'================================================================';
GO
