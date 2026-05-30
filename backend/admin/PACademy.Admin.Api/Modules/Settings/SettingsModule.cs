using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Settings;

public static class SettingsModule
{
    public static IServiceCollection AddSettingsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IGeneralSettingsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<GeneralSettingsService>();
        return services;
    }
}
