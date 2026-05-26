using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public sealed class ApplicantGradesAdminDbContextFactory : IDesignTimeDbContextFactory<ApplicantGradesAdminDbContext>
{
    public ApplicantGradesAdminDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("EFCORE_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            var settingsPath = FindAppSettings(Directory.GetCurrentDirectory());
            var config = new ConfigurationBuilder()
                .SetBasePath(Path.GetDirectoryName(settingsPath)!)
                .AddJsonFile(Path.GetFileName(settingsPath), optional: false)
                .Build();

            connectionString = config.GetConnectionString("Default")
                ?? throw new InvalidOperationException($"No 'Default' connection string in {settingsPath}.");
        }

        var options = new DbContextOptionsBuilder<ApplicantGradesAdminDbContext>()
            .UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_ApplicantGradesAdmin")
                .MigrationsAssembly(typeof(ApplicantGradesAdminDbContext).Assembly.FullName))
            .Options;

        return new ApplicantGradesAdminDbContext(options);
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
