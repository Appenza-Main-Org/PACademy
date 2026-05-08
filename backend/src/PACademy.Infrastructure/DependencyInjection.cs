using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Application.Admin.Applicants;
using PACademy.Application.Audit;
using PACademy.Application.Auth;
using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Auth;
using PACademy.Infrastructure.Audit;
using PACademy.Infrastructure.Identity;
using PACademy.Infrastructure.Persistence;
using PACademy.Infrastructure.Reports;
using PACademy.Infrastructure.Seeding;

namespace PACademy.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPaInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<PaDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsAssembly(typeof(PaDbContext).Assembly.FullName)));

        services.AddScoped<IPaDbContext>(sp => sp.GetRequiredService<PaDbContext>());

        services.AddIdentity<SystemUser, IdentityRole<Guid>>(opt =>
            {
                opt.Password.RequireDigit = true;
                opt.Password.RequiredLength = 8;
                opt.Password.RequireUppercase = false;
                opt.Password.RequireNonAlphanumeric = false;
                opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                opt.Lockout.MaxFailedAccessAttempts = 5;
                opt.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<PaDbContext>()
            .AddDefaultTokenProviders();

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

        // RBAC policies — Phase 3 carve-out from T065. Phase 4 will add the
        // remaining 8 app policies + role-tier policies.
        services.AddAuthorization(opts =>
        {
            opts.AddPolicy("AppAccess:admin", p =>
                p.RequireAuthenticatedUser().RequireClaim("apps", "admin"));
        });

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:5173"];

        services.AddCors(opt =>
            opt.AddDefaultPolicy(policy =>
                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        services.AddScoped<IAuditWriter, AuditWriter>();
        services.AddScoped<IIdentityProvider, InSystemIdentityProvider>();

        // Phase 3 — Admin applicants use cases
        services.AddScoped<ListApplicantsUseCase>();
        services.AddScoped<GetApplicantUseCase>();
        services.AddScoped<UpdateApplicantUseCase>();
        services.AddScoped<IValidator<ApplicantPatchDto>, ApplicantPatchValidator>();

        // Phase 4 (T064 draft) — Auth use cases
        services.AddScoped<LoginUseCase>();
        services.AddScoped<LogoutUseCase>();
        services.AddScoped<GetMeUseCase>();
        services.AddScoped<IValidator<LoginRequest>, LoginRequestValidator>();

        services.AddHostedService<ReportSnapshotsRefresher>();
        services.AddScoped<DemoDataSeeder>();

        return services;
    }
}
