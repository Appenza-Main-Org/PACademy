using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public static class ApplicantGradesAdminModule
{
    public static IServiceCollection AddApplicantGradesAdminModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is required for the admin backend.");

        services.AddDbContext<ApplicantGradesAdminDbContext>(opt =>
            opt.UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_ApplicantGradesAdmin")
                .MigrationsAssembly(typeof(ApplicantGradesAdminDbContext).Assembly.FullName)));

        services.AddScoped<IApplicantGradesAdminDbContext>(sp => sp.GetRequiredService<ApplicantGradesAdminDbContext>());
        services.AddScoped<IAuditApi, NoopAuditApi>();

        services.AddScoped<ListGradesUseCase>();
        services.AddScoped<FindGradeByNidUseCase>();
        services.AddScoped<ClearGradesUseCase>();
        services.AddScoped<StageImportUseCase>();
        services.AddScoped<CommitStagedImportUseCase>();
        services.AddScoped<RunImportPreflightUseCase>();
        services.AddScoped<RunImportCommitUseCase>();
        services.AddScoped<AddAdjustmentUseCase>();
        services.AddScoped<ToggleAdjustmentUseCase>();
        services.AddScoped<DeleteAdjustmentUseCase>();
        services.AddScoped<UpdateOverrideMaxUseCase>();

        services.AddScoped<IValidator<StageImportRequest>, StageImportValidator>();
        services.AddScoped<IValidator<RunImportCommitRequest>, RunImportCommitValidator>();
        services.AddScoped<IValidator<AddAdjustmentRequest>, AddAdjustmentValidator>();
        services.AddScoped<IValidator<UpdateOverrideMaxRequest>, UpdateOverrideMaxValidator>();

        return services;
    }
}
