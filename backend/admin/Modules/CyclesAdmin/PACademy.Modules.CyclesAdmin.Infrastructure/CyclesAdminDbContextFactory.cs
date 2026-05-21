using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PACademy.Modules.CyclesAdmin.Infrastructure;

public sealed class CyclesAdminDbContextFactory : IDesignTimeDbContextFactory<CyclesAdminDbContext>
{
    public CyclesAdminDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("EFCORE_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            var settingsPath = FindAppSettings(Directory.GetCurrentDirectory());
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Path.GetDirectoryName(settingsPath)!)
                .AddJsonFile(Path.GetFileName(settingsPath), optional: false)
                .AddEnvironmentVariables()
                .Build();

            connectionString = configuration.GetConnectionString("Default")
                ?? throw new InvalidOperationException($"No 'Default' connection string in {settingsPath}.");
        }

        var options = new DbContextOptionsBuilder<CyclesAdminDbContext>()
            .UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_CyclesAdmin")
                .MigrationsAssembly(typeof(CyclesAdminDbContext).Assembly.FullName))
            .Options;

        return new CyclesAdminDbContext(options);
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

        throw new InvalidOperationException($"Could not locate appsettings.json starting from {startDir}.");
    }
}
