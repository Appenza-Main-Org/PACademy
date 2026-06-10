using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Biometric;

public static class BiometricModule
{
    public static IServiceCollection AddBiometricModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Device seam. The ZKBioTime client + gateway are ALWAYS registered so the
        // integration can be turned on live from the admin connection screen — its
        // activation switch is "a server URL is configured" (DB-from-admin first,
        // then appsettings), not the startup Biometric:Mode flag. Biometric:Mode
        // only selects the fallback used when ZKBioTime is NOT configured:
        //   simulated (default) ↔ real (generic device HTTP SDK).
        var mode = configuration["Biometric:Mode"] ?? "simulated";
        var realMode = string.Equals(mode, "real", StringComparison.OrdinalIgnoreCase);

        services.AddHttpClient<ZkBioTimeClient>();
        services.AddScoped<ZkBioTimeBiometricDeviceGateway>();
        services.AddScoped<SimulatedBiometricDeviceGateway>();
        if (realMode)
            services.AddHttpClient<RealBiometricDeviceGateway>();

        // Auto-router: ZKBioTime when configured, else the mode-default fallback.
        services.AddScoped<IBiometricDeviceGateway>(sp => new AutoBiometricDeviceGateway(
            sp.GetRequiredService<ZkBioTimeClient>(),
            sp.GetRequiredService<ZkBioTimeBiometricDeviceGateway>(),
            realMode
                ? sp.GetRequiredService<RealBiometricDeviceGateway>()
                : sp.GetRequiredService<SimulatedBiometricDeviceGateway>()));

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

    /// <summary>
    /// Idempotent data fix: rewrites legacy 9-digit device emp_codes to the
    /// applicant's national id. Called unconditionally at startup — a failure
    /// here must never block boot (e.g. a fresh DB awaiting manual migration),
    /// so errors are logged and swallowed.
    /// </summary>
    public static async Task NormalizeBiometricDeviceCodesAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
            await scope.ServiceProvider.GetRequiredService<BiometricSeeder>().NormalizeDeviceEmpCodesAsync(db, ct);
        }
        catch (Exception ex)
        {
            scope.ServiceProvider.GetRequiredService<ILogger<BiometricSeeder>>()
                .LogWarning(ex, "Skipping biometric device-code normalization");
        }
    }
}
