using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PACademy.Admin.Api.Persistence;

public sealed class AdminDbContextFactory : IDesignTimeDbContextFactory<AdminDbContext>
{
    public AdminDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var database = configuration.ResolveAdminDatabaseSettings();
        AdminDbContext.ConfigureSchema(database.Schema);
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseSqlServer(
                database.ConnectionString
                ?? "Server=localhost;Database=PACademy_Admin;Trusted_Connection=True;TrustServerCertificate=True",
                sql => sql.MigrationsHistoryTable(AdminDbContext.MigrationsHistoryTable, AdminDbContext.Schema))
            .Options;

        return new AdminDbContext(options);
    }
}
