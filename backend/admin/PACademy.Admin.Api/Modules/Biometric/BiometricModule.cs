using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Biometric;

public static class BiometricModule
{
    public static IServiceCollection AddBiometricModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Device seam — switch on Biometric:Mode (simulated default ↔ real).
        var mode = configuration["Biometric:Mode"] ?? "simulated";
        if (string.Equals(mode, "real", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<IBiometricDeviceGateway, RealBiometricDeviceGateway>();
        }
        else
        {
            services.AddScoped<IBiometricDeviceGateway, SimulatedBiometricDeviceGateway>();
        }

        services.AddScoped<BiometricSeeder>();
        services.AddScoped<BiometricService>();
        return services;
    }

    public static async Task SeedBiometricAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<BiometricSeeder>().SeedAsync(db, ct);
    }
}
