using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Committees.Application;
using PACademy.Modules.Committees.Application.Committees;
using PACademy.Modules.Committees.Application.DateBindings;
using PACademy.Modules.Committees.Application.Members;
using PACademy.Modules.Committees.Infrastructure.Persistence;
using PACademy.Modules.Committees.Public;

namespace PACademy.Modules.Committees.Infrastructure;

public static class CommitteesModule
{
    public static IServiceCollection AddCommitteesModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<CommitteesDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Committees")
                       .MigrationsAssembly(typeof(CommitteesDbContext).Assembly.FullName)));

        services.AddScoped<ICommitteesDbContext>(sp => sp.GetRequiredService<CommitteesDbContext>());
        services.AddScoped<ICommitteeApi, CommitteesApiService>();

        // Committees use cases
        services.AddScoped<ListCommitteesUseCase>();
        services.AddScoped<GetCommitteeUseCase>();
        services.AddScoped<CreateCommitteeUseCase>();
        services.AddScoped<UpdateCommitteeUseCase>();
        services.AddScoped<ArchiveCommitteeUseCase>();
        services.AddScoped<RestoreCommitteeUseCase>();

        // Member use cases
        services.AddScoped<AddCommitteeMemberUseCase>();
        services.AddScoped<RemoveCommitteeMemberUseCase>();

        // Date-binding use cases
        services.AddScoped<ListDateBindingsUseCase>();
        services.AddScoped<UpsertDateBindingUseCase>();
        services.AddScoped<RemoveDateBindingUseCase>();

        return services;
    }
}
