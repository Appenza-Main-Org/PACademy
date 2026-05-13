using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Lookups.Application;
using PACademy.Modules.Lookups.Infrastructure.Persistence;

namespace PACademy.Modules.Lookups.Infrastructure;

public static class LookupsModule
{
    public static IServiceCollection AddLookupsModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<LookupsDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Lookups")
                       .MigrationsAssembly(typeof(LookupsDbContext).Assembly.FullName)));

        services.AddScoped<ILookupsDbContext>(sp => sp.GetRequiredService<LookupsDbContext>());

        services.AddScoped<ListLookupItemTypesUseCase>();
        services.AddScoped<ListLookupItemsUseCase>();
        services.AddScoped<GetLookupItemUseCase>();
        services.AddScoped<CreateLookupItemUseCase>();
        services.AddScoped<UpdateLookupItemUseCase>();
        services.AddScoped<SoftDeleteLookupItemUseCase>();

        return services;
    }
}
