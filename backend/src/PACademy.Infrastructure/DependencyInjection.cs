using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Application.Admin.AdmissionRules;
using PACademy.Application.Admin.Applicants;
using PACademy.Application.Admin.Categories;
using PACademy.Application.Admin.Cycles;
using PACademy.Application.Admin.ReferenceData;
using PACademy.Application.Admin.Users;
using PACademy.Application.Audit;
using PACademy.Application.Auth;
using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Contracts.Admin.AdmissionRules;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Admin.Categories;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Contracts.Admin.ReferenceData;
using PACademy.Contracts.Admin.Users;
using PACademy.Contracts.Auth;
using PACademy.Infrastructure.Audit;
using PACademy.Infrastructure.Identity;
using PACademy.Infrastructure.Persistence;
using PACademy.Infrastructure.Reports;
using PACademy.Infrastructure.Seeding;
using System.Security.Claims;

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

        // T143: Full RBAC policy matrix — one AppAccess policy per app key + one Role policy per role.
        services.AddAuthorization(opts =>
        {
            // App access — one policy per app key (CLAUDE.md §5)
            foreach (var key in new[]
            {
                "admin", "committee", "board", "investigations",
                "medical", "barcode", "biometric", "exams", "applicant", "architecture",
            })
            {
                opts.AddPolicy($"AppAccess:{key}", p =>
                    p.RequireAuthenticatedUser().RequireClaim("apps", key));
            }

            // Role tier — one policy per RBAC role (RoleApps.AllRoles)
            foreach (var role in RoleApps.AllRoles)
            {
                var roleName = role; // capture for closure
                opts.AddPolicy($"Role:{roleName}", p =>
                    p.RequireAuthenticatedUser().RequireClaim(ClaimTypes.Role, roleName));
            }
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

        // Auth use cases
        services.AddScoped<LoginUseCase>();
        services.AddScoped<LogoutUseCase>();
        services.AddScoped<GetMeUseCase>();
        services.AddScoped<IValidator<LoginRequest>, LoginRequestValidator>();

        // T173 — Admin Users use cases (Phase 4, US2)
        services.AddScoped<ListSystemUsersUseCase>();
        services.AddScoped<GetSystemUserUseCase>();
        services.AddScoped<CreateSystemUserUseCase>();
        services.AddScoped<UpdateSystemUserUseCase>();
        services.AddScoped<IValidator<CreateSystemUserRequest>, CreateSystemUserValidator>();

        // T239/T240 — Admin Cycles use cases (Spec 004, US2)
        services.AddScoped<ListCyclesUseCase>();
        services.AddScoped<GetCycleUseCase>();
        services.AddScoped<CreateCycleUseCase>();
        services.AddScoped<UpdateCycleUseCase>();
        services.AddScoped<TransitionCycleStatusUseCase>();
        services.AddScoped<DeleteCycleUseCase>();
        services.AddScoped<IValidator<CreateCycleRequest>, CreateCycleValidator>();

        // Spec 004 US1 — Reference Data use cases
        services.AddScoped<ListReferenceDataUseCase>();
        services.AddScoped<GetReferenceDataUseCase>();
        services.AddScoped<CreateReferenceDataUseCase>();
        services.AddScoped<UpdateReferenceDataUseCase>();
        services.AddScoped<ArchiveReferenceDataUseCase>();
        services.AddScoped<IValidator<CreateReferenceDataRequest>, CreateReferenceDataValidator>();

        // Spec 004 US3 — Categories use cases
        services.AddScoped<ListCategoriesUseCase>();
        services.AddScoped<GetCategoryUseCase>();
        services.AddScoped<CreateCategoryUseCase>();
        services.AddScoped<UpdateCategoryUseCase>();
        services.AddScoped<DeleteCategoryUseCase>();

        // Spec 004 US4 — Admission Rules use cases
        services.AddScoped<ListAdmissionRulesUseCase>();
        services.AddScoped<GetAdmissionRuleUseCase>();
        services.AddScoped<CreateAdmissionRuleUseCase>();

        services.AddHostedService<ReportSnapshotsRefresher>();
        services.AddScoped<DemoDataSeeder>();

        return services;
    }
}
