using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PACademy.Infrastructure.Persistence;
using PACademy.Modules.Identity.Infrastructure.Persistence;

namespace PACademy.Api.Tests.Fixtures;

/// <summary>
/// WebApplicationFactory for OTP flow integration tests.
/// Unlike ApiFactory, this does NOT replace the cookie authentication scheme,
/// so real session cookies issued by VerifyOtp can be sent to subsequent requests.
/// Both PaDbContext and IdentityDbContext are redirected to the test DB.
/// </summary>
public sealed class OtpApiFactory(IdentityFixture fixture)
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Redirect PaDbContext to the test DB
            services.RemoveAll<DbContextOptions<PaDbContext>>();
            services.RemoveAll<PaDbContext>();
            services.AddDbContext<PaDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString));

            // Redirect IdentityDbContext to the test DB
            services.RemoveAll<DbContextOptions<IdentityDbContext>>();
            services.RemoveAll<IdentityDbContext>();
            services.AddDbContext<IdentityDbContext>(opt =>
                opt.UseSqlServer(fixture.ConnectionString,
                    o => o.MigrationsHistoryTable("__EFMigrationsHistory_Identity")
                           .MigrationsAssembly(typeof(IdentityDbContext).Assembly.FullName)));
        });

        builder.UseEnvironment("Testing");
    }
}
