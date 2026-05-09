using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Workflows.Infrastructure.Persistence;
using PACademy.Modules.Workflows.Public;

namespace PACademy.Modules.Workflows.Infrastructure;

public static class WorkflowsModule
{
    public static IServiceCollection AddWorkflowsModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<WorkflowsDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Workflows")
                       .MigrationsAssembly(typeof(WorkflowsDbContext).Assembly.FullName)));

        services.AddScoped<IWorkflowsApi, WorkflowsApiService>();

        return services;
    }
}
