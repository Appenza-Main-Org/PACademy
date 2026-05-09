using Microsoft.Data.SqlClient;

namespace PACademy.Api.Hosting;

/// <summary>
/// One-shot startup hook that splits the legacy __EFMigrationsHistory table into
/// 5 per-context history tables (one per bounded-context DbContext).
/// Runs only in Development and Staging; skipped in Production unless
/// MIGRATION_CUTOVER_ENABLED=true is set explicitly.
/// The SQL is idempotent — safe to run repeatedly.
/// </summary>
public static class MigrationHistoryCutover
{
    public static async Task RunIfNeededAsync(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger logger,
        CancellationToken ct = default)
    {
        var enabled = environment.IsDevelopment()
            || environment.IsStaging()
            || string.Equals(configuration["MIGRATION_CUTOVER_ENABLED"], "true",
                StringComparison.OrdinalIgnoreCase);

        if (!enabled)
        {
            logger.LogDebug("Migration history cutover skipped (not Development/Staging and opt-in not set).");
            return;
        }

        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogWarning("Migration history cutover skipped — 'Default' connection string not configured.");
            return;
        }

        // Only run if the legacy __EFMigrationsHistory table exists (pre-phase-5 DB)
        // and the split hasn't been applied yet.
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);

        var legacyExists = await LegacyTableExistsAsync(conn, ct);
        if (!legacyExists)
        {
            logger.LogDebug("__EFMigrationsHistory does not exist — fresh DB or already fully migrated. Cutover skipped.");
            return;
        }

        var splitDone = await SplitAlreadyDoneAsync(conn, ct);
        if (splitDone)
        {
            logger.LogInformation("Migration history split already applied — skipping.");
            return;
        }

        logger.LogInformation("Applying migration history split (005_split_migration_history.sql)...");
        await RunSplitSqlAsync(conn, ct);
        logger.LogInformation("Migration history split complete.");
    }

    private static async Task<bool> LegacyTableExistsAsync(SqlConnection conn, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.tables WHERE name = '__EFMigrationsHistory'";
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> SplitAlreadyDoneAsync(SqlConnection conn, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.tables WHERE name = '__EFMigrationsHistory_Admissions'";
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task RunSplitSqlAsync(SqlConnection conn, CancellationToken ct)
    {
        // Inline the idempotent split — avoids file-path resolution across deployment environments.
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__EFMigrationsHistory_Admissions')
            BEGIN
                CREATE TABLE __EFMigrationsHistory_Audit (
                    MigrationId nvarchar(150) NOT NULL,
                    ProductVersion nvarchar(32) NOT NULL,
                    CONSTRAINT PK_EFMigrationsHistory_Audit PRIMARY KEY (MigrationId)
                );
                CREATE TABLE __EFMigrationsHistory_Identity (
                    MigrationId nvarchar(150) NOT NULL,
                    ProductVersion nvarchar(32) NOT NULL,
                    CONSTRAINT PK_EFMigrationsHistory_Identity PRIMARY KEY (MigrationId)
                );
                CREATE TABLE __EFMigrationsHistory_ReferenceData (
                    MigrationId nvarchar(150) NOT NULL,
                    ProductVersion nvarchar(32) NOT NULL,
                    CONSTRAINT PK_EFMigrationsHistory_ReferenceData PRIMARY KEY (MigrationId)
                );
                CREATE TABLE __EFMigrationsHistory_Workflows (
                    MigrationId nvarchar(150) NOT NULL,
                    ProductVersion nvarchar(32) NOT NULL,
                    CONSTRAINT PK_EFMigrationsHistory_Workflows PRIMARY KEY (MigrationId)
                );
                CREATE TABLE __EFMigrationsHistory_Admissions (
                    MigrationId nvarchar(150) NOT NULL,
                    ProductVersion nvarchar(32) NOT NULL,
                    CONSTRAINT PK_EFMigrationsHistory_Admissions PRIMARY KEY (MigrationId)
                );

                INSERT INTO __EFMigrationsHistory_Audit (MigrationId, ProductVersion)
                SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
                WHERE MigrationId IN ('20260508121214_AuditImmutabilityTrigger');

                INSERT INTO __EFMigrationsHistory_Identity (MigrationId, ProductVersion)
                SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
                WHERE MigrationId IN ('20260508121134_Initial');

                INSERT INTO __EFMigrationsHistory_Admissions (MigrationId, ProductVersion)
                SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
                WHERE MigrationId IN (
                    '20260508121231_ReportSnapshotTables',
                    '20260509130659_004_LookupsCrudExtensions',
                    '20260509144412_004b_LookupsCrudCompleteSchema'
                );
            END
            """;

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
