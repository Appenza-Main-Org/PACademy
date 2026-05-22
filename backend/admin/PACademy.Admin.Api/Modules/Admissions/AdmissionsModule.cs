using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Admissions;

public static class AdmissionsModule
{
    public static IServiceCollection AddAdmissionsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IAdmissionsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<AdmissionsSeeder>();
        services.AddScoped<CyclesService>();
        services.AddScoped<CategoriesService>();
        services.AddScoped<AdmissionRulesService>();
        services.AddScoped<ApplicationSettingsService>();
        return services;
    }

    public static async Task SeedAdmissionsAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<AdmissionsSeeder>().SeedAsync(db, ct);
    }
}
