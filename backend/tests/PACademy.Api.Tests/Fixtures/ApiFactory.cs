using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PACademy.Infrastructure.Persistence;
using PACademy.Infrastructure.Seeding;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// WebApplicationFactory configured to use the SqlServerFixture's connection
/// string and a TestAuthHandler that injects a fake admin user.
/// </summary>
public sealed class ApiFactory(SqlServerFixture sqlFixture, bool seedDemo = false)
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<PaDbContext>>();
            services.RemoveAll<PaDbContext>();

            services.AddDbContext<PaDbContext>(opt =>
                opt.UseSqlServer(sqlFixture.ConnectionString));

            // Override the cookie auth scheme with the TestAuthHandler so
            // integration tests skip the (not-yet-built) /auth/login flow.
            services.AddAuthentication(opt =>
            {
                opt.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                opt.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                opt.DefaultScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                TestAuthHandler.SchemeName, _ => { });
        });

        builder.UseEnvironment("Testing");
    }

    public async Task InitializeAsync()
    {
        if (!seedDemo) return;

        using var scope = Services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<DemoDataSeeder>();
        await seeder.SeedAsync(CancellationToken.None);
    }
}
