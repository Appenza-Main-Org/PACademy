using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Admissions.Application;
using PACademy.Modules.Admissions.Application.Admin.AdmissionRules;
using PACademy.Modules.Admissions.Application.Admin.Applicants;
using PACademy.Modules.Admissions.Application.Admin.Categories;
using PACademy.Modules.Admissions.Application.Admin.Cycles;
using PACademy.Modules.Admissions.Application.Admin.WizardStatus;
using PACademy.Modules.Admissions.Application.Admin.MergeSplit;
using PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;
using PACademy.Modules.Admissions.Application.Admin.ExamDateConfigs;
using PACademy.Modules.Admissions.Application.Admin.TotalScore;
using PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;
using PACademy.Modules.Admissions.Application.Admin.CycleExams;
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

        services.AddSingleton<WizardStatusInterceptor>();

        services.AddDbContext<AdmissionsDbContext>((sp, opt) =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Admissions")
                       .MigrationsAssembly(typeof(AdmissionsDbContext).Assembly.FullName))
               .AddInterceptors(sp.GetRequiredService<WizardStatusInterceptor>()));

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

        // WizardStatus use cases
        services.AddScoped<GetWizardStepStatusesUseCase>();
        services.AddScoped<CompleteWizardStepUseCase>();
        services.AddScoped<ReopenWizardStepUseCase>();
        services.AddScoped<AutoPromoteWizardStepUseCase>();

        // MergeSplit use cases
        services.AddScoped<ListMergeSplitRulesUseCase>();
        services.AddScoped<GetMergeSplitRuleUseCase>();
        services.AddScoped<CreateMergeSplitRuleUseCase>();
        services.AddScoped<UpdateMergeSplitRuleUseCase>();
        services.AddScoped<CancelMergeSplitRuleUseCase>();
        services.AddScoped<ArchiveMergeSplitRuleUseCase>();
        services.AddScoped<PreviewMergeSplitRuleUseCase>();
        services.AddScoped<ApplyMergeSplitRuleUseCase>();

        // ScoreThresholds use cases
        services.AddScoped<ListScoreThresholdsUseCase>();
        services.AddScoped<GetScoreThresholdUseCase>();
        services.AddScoped<UpsertScoreThresholdUseCase>();

        // ExamDateConfig use cases
        services.AddScoped<GetExamDateConfigUseCase>();
        services.AddScoped<UpsertExamDateConfigUseCase>();

        // TotalScore use cases
        services.AddScoped<ListTotalScoreConfigsUseCase>();
        services.AddScoped<GetTotalScoreConfigUseCase>();
        services.AddScoped<UpsertTotalScoreConfigUseCase>();

        // ElectronicDeclaration use cases
        services.AddScoped<ListDeclarationVersionsUseCase>();
        services.AddScoped<GetPublishedDeclarationUseCase>();
        services.AddScoped<CreateDeclarationDraftUseCase>();
        services.AddScoped<UpdateDeclarationUseCase>();
        services.AddScoped<PublishDeclarationUseCase>();
        services.AddScoped<ArchiveDeclarationUseCase>();

        // CycleExam use cases
        services.AddScoped<ListCycleExamsUseCase>();
        services.AddScoped<CreateCycleExamUseCase>();
        services.AddScoped<UpdateCycleExamUseCase>();
        services.AddScoped<ReorderCycleExamsUseCase>();
        services.AddScoped<ArchiveCycleExamUseCase>();
        services.AddScoped<RestoreCycleExamUseCase>();

        return services;
    }
}
