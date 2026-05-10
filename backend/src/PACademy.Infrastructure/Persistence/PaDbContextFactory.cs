using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using PACademy.Application.Common;

namespace PACademy.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used by `dotnet ef migrations add`/`database update`.
/// Reads the connection string from PACademy.Api's appsettings (matching the
/// runtime configuration), so design-time and runtime never disagree on which
/// DB they target. Falls back to local docker only if no config is found.
/// </summary>
internal sealed class PaDbContextFactory : IDesignTimeDbContextFactory<PaDbContext>
{
    public PaDbContext CreateDbContext(string[] args)
    {
        var connectionString = ResolveConnectionString();

        var options = new DbContextOptionsBuilder<PaDbContext>()
            .UseSqlServer(connectionString,
                o => o.MigrationsAssembly(typeof(PaDbContext).Assembly.FullName))
            .Options;

        return new PaDbContext(options, NullCurrentUser.Instance);
    }

    private static string ResolveConnectionString()
    {
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? "Development";

        // dotnet ef sets cwd to either the --project or --startup-project. Probe
        // both: the Api directory (sibling of Infrastructure) and the cwd itself.
        var cwd = Directory.GetCurrentDirectory();
        var apiSibling = Path.GetFullPath(Path.Combine(cwd, "..", "PACademy.Api"));
        var basePath = Directory.Exists(apiSibling) && File.Exists(Path.Combine(apiSibling, "appsettings.json"))
            ? apiSibling
            : cwd;

        var config = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{env}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        return config.GetConnectionString("Default")
            ?? "Server=localhost,1433;Database=PACademy;User Id=sa;Password=P@ssw0rd!Dev;TrustServerCertificate=True;";
    }

    private sealed class NullCurrentUser : ICurrentUser
    {
        public static readonly NullCurrentUser Instance = new();
        public Guid Id => Guid.Empty;
        public string Name => "migrations";
        public string IpAddress => "::1";
        public bool IsAuthenticated => false;
    }
}
