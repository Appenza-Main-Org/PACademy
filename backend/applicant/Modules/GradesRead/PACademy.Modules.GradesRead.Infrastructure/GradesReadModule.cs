using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.GradesRead.Application;

namespace PACademy.Modules.GradesRead.Infrastructure;

public static class GradesReadModule
{
    public static IServiceCollection AddGradesReadModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var useInMemory = configuration.GetValue<bool>("UseInMemoryDatabase");
        var connectionString = configuration.GetConnectionString("Default");

        services.AddDbContext<GradesReadDbContext>(opt =>
        {
            if (useInMemory || string.IsNullOrWhiteSpace(connectionString))
            {
                opt.UseInMemoryDatabase("pacademy-shared-grades");
            }
            else
            {
                opt.UseSqlServer(connectionString);
            }
            opt.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
        });

        services.AddScoped<IGradesReadDbContext>(sp => sp.GetRequiredService<GradesReadDbContext>());
        services.AddScoped<FindGradeByNidReadUseCase>();
        return services;
    }
}
