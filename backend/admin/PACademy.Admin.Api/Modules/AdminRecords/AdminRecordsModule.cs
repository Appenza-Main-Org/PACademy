using PACademy.Admin.Api.Persistence;
using PACademy.Admin.Api.Modules.OperationalRecords;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public static class AdminRecordsModule
{
    public static IServiceCollection AddAdminRecordsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IAdminRecordsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<IOperationalRecordsDbContext>(sp => sp.GetRequiredService<AdminDbContext>());
        services.AddScoped<OperationalRecordStore>();
        services.AddScoped<AdminRecordsSeeder>();
        services.AddScoped<OperationalRecordsService>();
        return services;
    }

    public static async Task SeedAdminRecordsAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        await scope.ServiceProvider.GetRequiredService<AdminRecordsSeeder>().SeedAsync(db, ct);
    }
}
