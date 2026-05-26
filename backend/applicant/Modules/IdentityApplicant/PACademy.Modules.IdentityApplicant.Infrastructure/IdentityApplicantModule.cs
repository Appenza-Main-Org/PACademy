using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Modules.IdentityApplicant.Infrastructure;

/// <summary>
/// Composition root for the applicant-side IdentityApplicant module:
///   • DbContext (writable) for the <c>applicants</c> table
///   • <see cref="IMoiClient"/> — Dev: <see cref="MoiMockClient"/>;
///     Prod (TODO): HTTP impl
///   • <see cref="IJwtTokenService"/> — HS256, audience 'applicant-api'
///   • Login / GetMe / FetchMoiVerification use cases
///
/// JWT bearer middleware itself is wired in Program.cs.
/// </summary>
public static class IdentityApplicantModule
{
    public static IServiceCollection AddIdentityApplicantModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Connection string 'Default' is required.");

        services.AddDbContext<ApplicantsDbContext>(opt =>
            opt.UseSqlServer(connectionString));    // NO MigrationsAssembly — admin owns DDL.
        services.AddScoped<IApplicantsDbContext>(sp => sp.GetRequiredService<ApplicantsDbContext>());

        /* MOI client — Dev mocks, Prod swaps for HTTP impl when ready.
         * Toggle via Mock:MoiClient (default true outside Production). */
        var useMock = configuration.GetValue<bool?>("Mock:MoiClient") ?? true;
        if (useMock)
        {
            services.AddSingleton<IMoiClient, MoiMockClient>();
        }
        else
        {
            throw new NotImplementedException(
                "Real MoiHttpClient not implemented yet. Set Mock:MoiClient=true for dev.");
        }

        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddScoped<LoginUseCase>();
        services.AddScoped<GetMeUseCase>();
        services.AddScoped<FetchMoiVerificationUseCase>();

        return services;
    }
}
