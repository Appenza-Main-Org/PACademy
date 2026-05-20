using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PACademy.Modules.LookupsAdmin.Infrastructure;

/// <summary>
/// Design-time factory used by <c>dotnet ef migrations add/database update</c>.
/// Builds the DbContext without booting the full Program.cs host, so EF
/// tooling never touches Swagger / DI / startup quirks.
///
/// The connection string can come from:
///   1. <c>EFCORE_CONNECTION_STRING</c> environment variable, OR
///   2. <c>appsettings.json</c> in the Api project (default for local dev)
/// </summary>
public sealed class LookupsAdminDbContextFactory : IDesignTimeDbContextFactory<LookupsAdminDbContext>
{
    public LookupsAdminDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("EFCORE_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            /* dotnet ef sets CWD to the startup project (Api dir).
             * Fall back to walking up two levels in case the tool was
             * run from elsewhere. */
            var cwd = Directory.GetCurrentDirectory();
            var settingsPath = FindAppSettings(cwd);

            var config = new ConfigurationBuilder()
                .SetBasePath(Path.GetDirectoryName(settingsPath)!)
                .AddJsonFile(Path.GetFileName(settingsPath), optional: false)
                .Build();

            connectionString = config.GetConnectionString("Default")
                ?? throw new InvalidOperationException(
                    $"No 'Default' connection string in {settingsPath}.");
        }

        var options = new DbContextOptionsBuilder<LookupsAdminDbContext>()
            .UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_LookupsAdmin")
                .MigrationsAssembly(typeof(LookupsAdminDbContext).Assembly.FullName))
            .Options;

        return new LookupsAdminDbContext(options);
    }

    private static string FindAppSettings(string startDir)
    {
        var dir = new DirectoryInfo(startDir);
        while (dir is not null)
        {
            var probe = Path.Combine(dir.FullName, "PACademy.Admin.Api", "appsettings.json");
            if (File.Exists(probe)) return probe;
            probe = Path.Combine(dir.FullName, "appsettings.json");
            if (File.Exists(probe)) return probe;
            dir = dir.Parent;
        }
        throw new InvalidOperationException(
            $"Could not locate appsettings.json starting from {startDir}.");
    }
}
