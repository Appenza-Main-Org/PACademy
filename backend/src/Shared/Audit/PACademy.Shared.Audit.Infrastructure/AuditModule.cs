using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Audit.Infrastructure.Persistence;
using PACademy.Shared.Audit.Public;

namespace PACademy.Shared.Audit.Infrastructure;

public static class AuditModule
{
    public static IServiceCollection AddAuditModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<AuditDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Audit")
                       .MigrationsAssembly(typeof(AuditDbContext).Assembly.FullName)));

        services.AddScoped<IAuditApi, AuditApiService>();

        return services;
    }
}
