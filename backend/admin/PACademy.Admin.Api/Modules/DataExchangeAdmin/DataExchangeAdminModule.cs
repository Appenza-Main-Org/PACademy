namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// DI registration for the Data-Exchange module. Reuses the shared
/// <c>AdminDbContext</c>, <c>IAuditSink</c>, and the change-tracking actor
/// provider (registered by the Lookups + Audit modules) — adds no new DbContext
/// and no new migration of its own (the additive change-tracking migration is
/// owned by the main AdminDbContext).
/// </summary>
public static class DataExchangeAdminModule
{
    public static IServiceCollection AddDataExchangeAdminModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<DataExchangeService>();
        return services;
    }
}
