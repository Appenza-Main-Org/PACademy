using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PACademy.Infrastructure.Persistence;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using PACademy.Modules.Committees.Infrastructure.Persistence;
using PACademy.Modules.Notifications.Infrastructure.Persistence;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// WebApplicationFactory for admission-setup integration tests.
/// Replaces PaDbContext, AdmissionsDbContext, CommitteesDbContext, and
/// NotificationsDbContext with connections pointed at the Testcontainers instance.
/// </summary>
public sealed class AdmissionSetupApiFactory(AdmissionSetupFixture fixture, string testRole = "super_admin")
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Legacy context
            services.RemoveAll<DbContextOptions<PaDbContext>>();
            services.RemoveAll<PaDbContext>();
            services.AddDbContext<PaDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString));

            // Admissions module
            services.RemoveAll<DbContextOptions<AdmissionsDbContext>>();
            services.RemoveAll<AdmissionsDbContext>();
            services.AddDbContext<AdmissionsDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString,
                    o => o.MigrationsAssembly(typeof(AdmissionsDbContext).Assembly.FullName)));

            // Committees module
            services.RemoveAll<DbContextOptions<CommitteesDbContext>>();
            services.RemoveAll<CommitteesDbContext>();
            services.AddDbContext<CommitteesDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString,
                    o => o.MigrationsAssembly(typeof(CommitteesDbContext).Assembly.FullName)));

            // Notifications module
            services.RemoveAll<DbContextOptions<NotificationsDbContext>>();
            services.RemoveAll<NotificationsDbContext>();
            services.AddDbContext<NotificationsDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString,
                    o => o.MigrationsAssembly(typeof(NotificationsDbContext).Assembly.FullName)));

            // Bypass real authentication — inject a fake token with the requested role.
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

    /// <summary>Creates an HTTP client pre-configured with the test role header.</summary>
    public HttpClient CreateRoleClient(string? role = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Role", role ?? testRole);
        return client;
    }
}
