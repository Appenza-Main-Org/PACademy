using Microsoft.EntityFrameworkCore;
using PACademy.Infrastructure.Persistence;
using Testcontainers.MsSql;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// Testcontainers.MsSql singleton fixture.
/// Note: SQL Server 2022 image is ~2 GB and takes ~20–30 s to boot.
/// Budget for this in CI test plans.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .WithEnvironment("ACCEPT_EULA", "Y")
        .WithEnvironment("MSSQL_PID", "Developer")
        .Build();

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();

        var options = new DbContextOptionsBuilder<PaDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;

        await using var db = new PaDbContext(options, NullCurrentUser.Instance);
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
