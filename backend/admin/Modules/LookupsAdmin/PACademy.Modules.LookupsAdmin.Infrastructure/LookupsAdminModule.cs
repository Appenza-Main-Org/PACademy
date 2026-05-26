using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.LookupsAdmin.Application.Faculties;

namespace PACademy.Modules.LookupsAdmin.Infrastructure;

/// <summary>
/// Composition root for the LookupsAdmin module. Wire from Program.cs:
///   <c>builder.Services.AddLookupsAdminModule(builder.Configuration);</c>
/// </summary>
public static class LookupsAdminModule
{
    public static IServiceCollection AddLookupsAdminModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Connection string 'Default' is required for the admin backend.");

        services.AddDbContext<LookupsAdminDbContext>(opt =>
            opt.UseSqlServer(connectionString, sql => sql
                .MigrationsHistoryTable("__EFMigrationsHistory_LookupsAdmin")
                .MigrationsAssembly(typeof(LookupsAdminDbContext).Assembly.FullName)));

        services.AddScoped<ILookupsAdminDbContext>(sp => sp.GetRequiredService<LookupsAdminDbContext>());

        // Use cases
        services.AddScoped<ListFacultiesUseCase>();
        services.AddScoped<CreateFacultyUseCase>();

        // FluentValidation validators (resolved by controllers via DI).
        services.AddScoped<IValidator<CreateFacultyRequest>, CreateFacultyValidator>();

        return services;
    }
}
