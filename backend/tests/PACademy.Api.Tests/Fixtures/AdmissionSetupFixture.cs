using Microsoft.EntityFrameworkCore;
using PACademy.Infrastructure.Persistence;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using PACademy.Modules.Committees.Infrastructure.Persistence;
using PACademy.Modules.Notifications.Infrastructure.Persistence;
using Testcontainers.MsSql;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// Testcontainers SQL Server fixture for admission-setup integration tests.
/// Migrates PaDbContext, AdmissionsDbContext, CommitteesDbContext, and
/// NotificationsDbContext — all four that the wizard endpoints touch.
/// </summary>
public sealed class AdmissionSetupFixture : IAsyncLifetime
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

        // Migrate the legacy context (for audit, applicant propagation, etc.)
        var paOpts = new DbContextOptionsBuilder<PaDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;
        await using (var db = new PaDbContext(paOpts, NullCurrentUser.Instance))
            await db.Database.MigrateAsync();

        // Migrate the modular contexts used by wizard endpoints.
        var admissionsOpts = new DbContextOptionsBuilder<AdmissionsDbContext>()
            .UseSqlServer(ConnectionString,
                o => o.MigrationsAssembly(typeof(AdmissionsDbContext).Assembly.FullName))
            .Options;
        await using (var db = new AdmissionsDbContext(admissionsOpts))
            await db.Database.MigrateAsync();

        var committeesOpts = new DbContextOptionsBuilder<CommitteesDbContext>()
            .UseSqlServer(ConnectionString,
                o => o.MigrationsAssembly(typeof(CommitteesDbContext).Assembly.FullName))
            .Options;
        await using (var db = new CommitteesDbContext(committeesOpts))
            await db.Database.MigrateAsync();

        var notificationsOpts = new DbContextOptionsBuilder<NotificationsDbContext>()
            .UseSqlServer(ConnectionString,
                o => o.MigrationsAssembly(typeof(NotificationsDbContext).Assembly.FullName))
            .Options;
        await using (var db = new NotificationsDbContext(notificationsOpts))
            await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}

[CollectionDefinition("AdmissionSetup")]
public sealed class AdmissionSetupCollection : ICollectionFixture<AdmissionSetupFixture> { }
