using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Lookups;

public static class LookupsModule
{
    public static IServiceCollection AddLookupsModule(this IServiceCollection services, IConfiguration configuration)
    {
        var database = configuration.ResolveAdminDatabaseSettings();
        AdminDbContext.ConfigureSchema(database.Schema);
        services.AddDbContext<AdminDbContext>(options =>
        {
            if (database.UseInMemory)
                options.UseInMemoryDatabase("PACademy_Admin");
            else
                options.UseSqlServer(
                    database.ConnectionString,
                    sql =>
                    {
                        sql.MigrationsHistoryTable(AdminDbContext.MigrationsHistoryTable, AdminDbContext.Schema);
                        sql.CommandTimeout(10);
                    });
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
