namespace PACademy.Admin.Api.Modules.Identity.Moi;

/// <summary>
/// Registers the MOI auth gateway. <c>Moi:Mode</c> selects the implementation:
///   "simulated" (default) → <see cref="SimulatedMoiAuthGateway"/> against the local store.
///   "real"               → <see cref="RealMoiAuthGateway"/> against the ministry API.
/// Switching mode is the whole migration once the real endpoints are available.
/// </summary>
public static class MoiModule
{
    public static IServiceCollection AddMoiAuthModule(this IServiceCollection services, IConfiguration config)
    {
        var mode = config["Moi:Mode"] ?? "simulated";
        if (string.Equals(mode, "real", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<IMoiAuthGateway, RealMoiAuthGateway>();
        }
        else
        {
            services.AddScoped<IMoiAuthGateway, SimulatedMoiAuthGateway>();
        }
        return services;
    }
}
