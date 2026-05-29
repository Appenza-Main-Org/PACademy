using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Exams;

public static class ExamsModule
{
    public static IServiceCollection AddExamsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ExamsSeeder>();
        services.AddScoped<IExamsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<ExamsService>();
        return services;
    }

    public static async Task SeedExamsAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<ExamsSeeder>().SeedAsync(db, ct);
    }
}
