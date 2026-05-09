using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Domain;
using PACademy.Modules.Identity.Infrastructure.Persistence;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Identity.Infrastructure;

public static class IdentityModule
{
    public static IServiceCollection AddIdentityModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<IdentityDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Identity")
                       .MigrationsAssembly(typeof(IdentityDbContext).Assembly.FullName)));

        services.AddScoped<IIdentityDbContext>(sp => sp.GetRequiredService<IdentityDbContext>());

        // NOTE: AspNet Core Identity store registration (UserManager/SignInManager backed by
        // IdentityDbContext) is intentionally NOT done here yet. The legacy AddPaInfrastructure
        // owns the auth stores against PaDbContext (which has the system_users table mapping).
        // This will switch over in spec 006 when controllers are wired to the new module.
        // Registering AspNet Identity stores here would override the legacy registration and
        // route auth queries through IdentityDbContext (which lacks the table mapping → AspNetUsers
        // not found at runtime).

        services.AddHttpContextAccessor();
        services.AddScoped<HttpContextCurrentUser>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<HttpContextCurrentUser>());
        services.AddScoped<ICurrentActor>(sp => sp.GetRequiredService<HttpContextCurrentUser>());

        // IIdentityProvider is intentionally not registered here yet — InSystemIdentityProvider
        // depends on UserManager<SystemUser> wired to IdentityDbContext, which is also disabled
        // until spec 006 swaps controllers from legacy to new module.

        services.AddScoped<IIdentityApi, IdentityApi>();

        return services;
    }
}
