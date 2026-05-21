using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Lookups;

public static class LookupsModule
{
    public static IServiceCollection AddLookupsModule(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AdminDb");
        services.AddDbContext<AdminDbContext>(options =>
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                options.UseInMemoryDatabase("PACademy_Admin");
            else
                options.UseSqlServer(connectionString);
        });
        services.AddScoped<ILookupsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<IValidator<System.Text.Json.Nodes.JsonObject>, LookupRowValidator>();
        services.AddScoped<LookupsService>();
        services.AddScoped<LookupsSeeder>();
        return services;
    }

    public static async Task SeedLookupsAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<LookupsSeeder>().SeedAsync(db, ct);
    }
}
