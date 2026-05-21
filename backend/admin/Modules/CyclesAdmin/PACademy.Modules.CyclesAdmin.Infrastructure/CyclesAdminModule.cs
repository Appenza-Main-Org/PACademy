using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Modules.CyclesAdmin.Infrastructure;

public static class CyclesAdminModule
{
    public static IServiceCollection AddCyclesAdminModule(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is required for the admin backend.");

        services.AddDbContext<CyclesAdminDbContext>(opt =>
            opt.UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_CyclesAdmin")
                .MigrationsAssembly(typeof(CyclesAdminDbContext).Assembly.FullName)));

        return services;
    }
}
