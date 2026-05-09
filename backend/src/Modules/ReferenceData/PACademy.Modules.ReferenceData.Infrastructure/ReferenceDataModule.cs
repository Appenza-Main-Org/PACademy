using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.ReferenceData.Application;
using PACademy.Modules.ReferenceData.Application.Admin;
using PACademy.Modules.ReferenceData.Infrastructure.Persistence;
using PACademy.Modules.ReferenceData.Public;

namespace PACademy.Modules.ReferenceData.Infrastructure;

public static class ReferenceDataModule
{
    public static IServiceCollection AddReferenceDataModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<ReferenceDataDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_ReferenceData")
                       .MigrationsAssembly(typeof(ReferenceDataDbContext).Assembly.FullName)));

        services.AddScoped<IReferenceDataDbContext>(sp =>
            sp.GetRequiredService<ReferenceDataDbContext>());

        services.AddScoped<IReferenceDataApi, ReferenceDataApiService>();

        // Use cases
        services.AddScoped<ListReferenceDataUseCase>();
        services.AddScoped<GetReferenceDataUseCase>();
        services.AddScoped<CreateReferenceDataUseCase>();
        services.AddScoped<CreateReferenceDataValidator>();
        services.AddScoped<UpdateReferenceDataUseCase>();
        services.AddScoped<ArchiveReferenceDataUseCase>();

        return services;
    }
}
