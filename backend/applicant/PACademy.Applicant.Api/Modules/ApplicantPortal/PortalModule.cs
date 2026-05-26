using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

public static class PortalModule
{
    public static IServiceCollection AddApplicantPortalModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is required.");

        services.AddDbContext<PortalDbContext>(opt =>
            opt.UseSqlServer(connectionString));    // NO MigrationsAssembly — admin owns DDL.

        services.AddScoped<PortalService>();
        return services;
    }
}
