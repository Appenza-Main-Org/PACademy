using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Persistence;

public static class AdminDatabaseInitializer
{
    public static async Task InitializeAdminDatabaseAsync(this WebApplication app, CancellationToken ct = default)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync(ct);
            return;
        }

        await db.Database.EnsureCreatedAsync(ct);
    }
}
