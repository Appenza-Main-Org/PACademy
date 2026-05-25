using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;

namespace PACademy.Admin.Api.Modules.Audit;

public static class AuditModule
{
    public static IServiceCollection AddAuditModule(this IServiceCollection services)
    {
        services.AddScoped<IAuditDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<IAuditSink, DbAuditSink>();
        return services;
    }
}
