using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Grades.Application;
using PACademy.Modules.Grades.Application.Adjustments;
using PACademy.Modules.Grades.Application.Grades;
using PACademy.Modules.Grades.Application.Import;
using PACademy.Modules.Grades.Infrastructure.Persistence;
using PACademy.Modules.Grades.Public;

namespace PACademy.Modules.Grades.Infrastructure;

public static class GradesModule
{
    public static IServiceCollection AddGradesModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<GradesDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Grades")
                       .MigrationsAssembly(typeof(GradesDbContext).Assembly.FullName)));

        services.AddScoped<IGradesDbContext>(sp => sp.GetRequiredService<GradesDbContext>());
        services.AddScoped<IGradeApi, GradesApiService>();

        // Grade reads
        services.AddScoped<ListGradesUseCase>();
        services.AddScoped<ListPaginatedGradesUseCase>();
        services.AddScoped<ExportGradesUseCase>();
        services.AddScoped<ClearAllGradesUseCase>();

        // Adjustments
        services.AddScoped<AddAdjustmentUseCase>();
        services.AddScoped<ToggleAdjustmentUseCase>();
        services.AddScoped<DeleteAdjustmentUseCase>();
        services.AddScoped<UpdateOverrideMaxUseCase>();

        // Import wizards
        services.AddScoped<StageImportUseCase>();
        services.AddScoped<CommitImportUseCase>();
        services.AddScoped<RunImportPreflightUseCase>();
        services.AddScoped<RunImportCommitUseCase>();

        return services;
    }
}
