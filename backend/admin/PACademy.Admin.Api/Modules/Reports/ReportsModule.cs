using PACademy.Admin.Api.Modules.Reports.Export;
using PACademy.Admin.Api.Modules.Reports.Queries;
using PACademy.Admin.Api.Modules.Reports.Validators;

namespace PACademy.Admin.Api.Modules.Reports;

public static class ReportsModule
{
    public static IServiceCollection AddReportsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ReportsQueryService>();
        services.AddScoped<ReportsOverviewService>();
        services.AddScoped<ReportsExportHandler>();
        services.AddScoped<ReportsFiltersValidator>();
        return services;
    }
}
