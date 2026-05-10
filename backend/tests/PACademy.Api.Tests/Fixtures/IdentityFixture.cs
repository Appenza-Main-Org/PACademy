using Microsoft.EntityFrameworkCore;
using PACademy.Infrastructure.Persistence;
using PACademy.Modules.Identity.Infrastructure.Persistence;
using Testcontainers.MsSql;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// Testcontainers fixture that migrates both PaDbContext and IdentityDbContext.
/// Used by OTP flow integration tests that exercise the full auth module.
/// </summary>
public sealed class IdentityFixture : IAsyncLifetime
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

        // Migrate legacy context first (creates system_users, sessions, AspNet tables, etc.)
        var paOptions = new DbContextOptionsBuilder<PaDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;
        await using var paDb = new PaDbContext(paOptions, NullCurrentUser.Instance);
        await paDb.Database.MigrateAsync();

        // Migrate Identity module context (creates pending_otps, lockout_states, lock_policy
        // via IF NOT EXISTS guards — safe to run after PaDbContext).
        var idOptions = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseSqlServer(ConnectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Identity")
                       .MigrationsAssembly(typeof(IdentityDbContext).Assembly.FullName))
            .Options;
        await using var idDb = new IdentityDbContext(idOptions);
        await idDb.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}

[CollectionDefinition("Identity")]
public sealed class IdentityCollection : ICollectionFixture<IdentityFixture>;
