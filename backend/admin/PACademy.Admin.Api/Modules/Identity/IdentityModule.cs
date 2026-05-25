using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Identity;

public static class IdentityModule
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IIdentityDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<IdentitySeeder>();
        services.AddScoped<UsersService>();
        services.AddScoped<RolesService>();
        return services;
    }

    public static async Task SeedIdentityAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<IdentitySeeder>().SeedAsync(db, ct);
    }
}
