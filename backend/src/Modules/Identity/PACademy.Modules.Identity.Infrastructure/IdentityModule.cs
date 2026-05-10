using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.Auth;
using PACademy.Modules.Identity.Application.Authorization;
using PACademy.Modules.Identity.Application.LockPolicies;
using PACademy.Modules.Identity.Application.Officers;
using PACademy.Modules.Identity.Domain;
using PACademy.Modules.Identity.Infrastructure.Officers;
using PACademy.Modules.Identity.Infrastructure.Otp;
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

        // T420: Re-enable AspNet Identity stores against IdentityDbContext (closes spec 005 deferred T326).
        services.AddIdentityCore<SystemUser>(opt =>
            {
                opt.Password.RequireDigit = true;
                opt.Password.RequiredLength = 8;
                opt.Password.RequireUppercase = false;
                opt.Password.RequireNonAlphanumeric = false;
                opt.Lockout.MaxFailedAccessAttempts = 5;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<IdentityDbContext>()
            .AddSignInManager<SignInManager<SystemUser>>()
            .AddDefaultTokenProviders();

        // Cookie authentication (replaces what AddIdentity used to provide implicitly)
        services.AddAuthentication(opt =>
            {
                opt.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
                opt.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
                opt.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
            })
            .AddCookie(IdentityConstants.ApplicationScheme);

        var timeoutMinutes = configuration.GetValue("Auth:SessionTimeoutMinutes", 480);
        services.ConfigureApplicationCookie(opt =>
        {
            opt.Cookie.Name = "pa-session";
            opt.Cookie.HttpOnly = true;
            opt.Cookie.SameSite = SameSiteMode.Strict;
            opt.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            opt.SlidingExpiration = true;
            opt.ExpireTimeSpan = TimeSpan.FromMinutes(timeoutMinutes);
            opt.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
            opt.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = 403;
                return Task.CompletedTask;
            };
        });

        services.AddHttpContextAccessor();
        services.AddScoped<HttpContextCurrentUser>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<HttpContextCurrentUser>());
        services.AddScoped<ICurrentActor>(sp => sp.GetRequiredService<HttpContextCurrentUser>());
        services.AddScoped<IIdentityProvider, InSystemIdentityProvider>();
        services.AddScoped<IIdentityApi, IdentityApi>();

        // OTP infrastructure
        services.AddScoped<IPendingOtpStore, SqlPendingOtpStore>();
        services.AddScoped<OtpCodeHasher>();

        // Use cases — US1 (OTP login + session lifecycle)
        services.AddScoped<RequestOtpUseCase>();
        services.AddScoped<VerifyOtpUseCase>();
        services.AddScoped<LogoutUseCase>();
        services.AddScoped<GetMeUseCase>();

        // Use cases — US2 (Lock policy)
        services.AddScoped<GetLockPolicyUseCase>();
        services.AddScoped<UpdateLockPolicyUseCase>();
        services.AddScoped<ListLockedUsersUseCase>();
        services.AddScoped<UnlockUserUseCase>();

        // Use cases — US3 (Officer lookup)
        services.AddScoped<LookupOfficerUseCase>();

        // Permissions — US4
        services.AddSingleton<IPermissionEvaluator, PermissionEvaluator>();

        // OTP transport selection
        var otpTransport = configuration["Otp:Transport"] ?? "Sms";
        if (otpTransport.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<IOtpTransport, InMemoryOtpTransport>();
        }
        else if (otpTransport.Equals("Sms", StringComparison.OrdinalIgnoreCase))
        {
            // SmsOtpTransport not yet implemented; throw loudly at startup for non-dev environments
            services.AddScoped<IOtpTransport>(_ =>
                throw new InvalidOperationException(
                    "OtpTransportNotConfigured: Sms transport is not yet implemented. " +
                    "Set Otp:Transport=InMemory for development."));
        }
        else
        {
            throw new InvalidOperationException($"Unknown Otp:Transport value '{otpTransport}'. Valid values: InMemory, Sms.");
        }

        // Officer lookup source selection
        var officerSource = configuration["OfficerLookup:Source"] ?? "Stub";

        if (officerSource.Equals("Stub", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<IOfficerLookup, StubOfficerLookup>();
        }
        else if (officerSource.Equals("MOIPASS", StringComparison.OrdinalIgnoreCase))
        {
            var baseUrl = configuration["OfficerLookup:Moipass:BaseUrl"];
            var apiKey = configuration["OfficerLookup:Moipass:ApiKey"];
            if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(apiKey))
                throw new InvalidOperationException(
                    "OfficerLookup:Source=MOIPASS requires OfficerLookup:Moipass:BaseUrl and OfficerLookup:Moipass:ApiKey to be configured.");

            services.AddHttpClient("Moipass");
            services.AddScoped<IOfficerLookup, MoipassOfficerLookup>();
        }
        else
        {
            throw new InvalidOperationException($"Unknown OfficerLookup:Source value '{officerSource}'. Valid values: Stub, MOIPASS.");
        }

        return services;
    }
}
