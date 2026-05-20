using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.LookupsRead.Application;

namespace PACademy.Modules.LookupsRead.Infrastructure;

/// <summary>
/// Composition root for the LookupsRead module — call once from
/// PACademy.Applicant.Api/Program.cs via
/// <c>builder.Services.AddLookupsReadModule(builder.Configuration);</c>.
/// </summary>
public static class LookupsReadModule
{
    public static IServiceCollection AddLookupsReadModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        /* Provider switch: dev uses InMemory so we can run end-to-end
         * without a SQL Server instance. Prod will flip to SqlServer
         * once the admin backend's migrations have been applied. */
        var useInMemory = configuration.GetValue<bool>("UseInMemoryDatabase");
        var connectionString = configuration.GetConnectionString("Default");

        services.AddDbContext<LookupsReadDbContext>(opt =>
        {
            if (useInMemory || string.IsNullOrWhiteSpace(connectionString))
            {
                opt.UseInMemoryDatabase("pacademy-shared");
            }
            else
            {
                opt.UseSqlServer(connectionString); // no MigrationsAssembly — read-only
            }
            opt.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
        });

        services.AddScoped<ILookupsReadDbContext>(sp => sp.GetRequiredService<LookupsReadDbContext>());
        services.AddScoped<ListActiveFacultiesUseCase>();

        return services;
    }
}
