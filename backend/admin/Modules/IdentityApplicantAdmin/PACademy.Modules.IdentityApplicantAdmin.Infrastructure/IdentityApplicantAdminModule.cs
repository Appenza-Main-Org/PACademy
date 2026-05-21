using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Modules.IdentityApplicantAdmin.Infrastructure;

/// <summary>
/// Composition root for the admin-side IdentityApplicant module.
/// Registers the DbContext that owns DDL for the <c>applicants</c>
/// table; the admin backend's startup calls
/// <see cref="IdentityApplicantAdminSeeder.MigrateAndSeed"/> to apply
/// migrations + insert the three demo rows.
/// </summary>
public static class IdentityApplicantAdminModule
{
    public static IServiceCollection AddIdentityApplicantAdminModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Connection string 'Default' is required for the admin backend.");

        services.AddDbContext<IdentityApplicantAdminDbContext>(opt =>
            opt.UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_IdentityApplicant")
                .MigrationsAssembly(typeof(IdentityApplicantAdminDbContext).Assembly.FullName)));

        return services;
    }
}
