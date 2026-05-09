using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Admissions.Application;
using PACademy.Modules.Admissions.Application.Admin.AdmissionRules;
using PACademy.Modules.Admissions.Application.Admin.Applicants;
using PACademy.Modules.Admissions.Application.Admin.Categories;
using PACademy.Modules.Admissions.Application.Admin.Cycles;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using PACademy.Modules.Admissions.Public;

namespace PACademy.Modules.Admissions.Infrastructure;

public static class AdmissionsModule
{
    public static IServiceCollection AddAdmissionsModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<AdmissionsDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Admissions")
                       .MigrationsAssembly(typeof(AdmissionsDbContext).Assembly.FullName)));

        services.AddScoped<IAdmissionsDbContext>(sp => sp.GetRequiredService<AdmissionsDbContext>());
        services.AddScoped<IAdmissionsApi, AdmissionsApiService>();

        // Cycles use cases
        services.AddScoped<ListCyclesUseCase>();
        services.AddScoped<GetCycleUseCase>();
        services.AddScoped<CreateCycleUseCase>();
        services.AddScoped<UpdateCycleUseCase>();
        services.AddScoped<TransitionCycleStatusUseCase>();
        services.AddScoped<DeleteCycleUseCase>();

        // Categories use cases
        services.AddScoped<ListCategoriesUseCase>();
        services.AddScoped<GetCategoryUseCase>();
        services.AddScoped<CreateCategoryUseCase>();
        services.AddScoped<UpdateCategoryUseCase>();
        services.AddScoped<DeleteCategoryUseCase>();

        // AdmissionRules use cases
        services.AddScoped<ListAdmissionRulesUseCase>();
        services.AddScoped<GetAdmissionRuleUseCase>();
        services.AddScoped<CreateAdmissionRuleUseCase>();

        // Applicants use cases
        services.AddScoped<ListApplicantsUseCase>();
        services.AddScoped<GetApplicantUseCase>();
        services.AddScoped<UpdateApplicantUseCase>();

        return services;
    }
}
