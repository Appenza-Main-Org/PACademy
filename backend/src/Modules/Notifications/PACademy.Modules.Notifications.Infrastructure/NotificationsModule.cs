using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Notifications.Application;
using PACademy.Modules.Notifications.Application.Templates;
using PACademy.Modules.Notifications.Infrastructure.Persistence;

namespace PACademy.Modules.Notifications.Infrastructure;

public static class NotificationsModule
{
    public static IServiceCollection AddNotificationsModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<NotificationsDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Notifications")
                       .MigrationsAssembly(typeof(NotificationsDbContext).Assembly.FullName)));

        services.AddScoped<INotificationsDbContext>(sp => sp.GetRequiredService<NotificationsDbContext>());

        // Template use cases
        services.AddScoped<ListNotificationTemplatesUseCase>();
        services.AddScoped<GetNotificationTemplateUseCase>();
        services.AddScoped<CreateNotificationTemplateUseCase>();
        services.AddScoped<UpdateNotificationTemplateUseCase>();
        services.AddScoped<PublishNotificationTemplateUseCase>();
        services.AddScoped<UnpublishNotificationTemplateUseCase>();
        services.AddScoped<ArchiveNotificationTemplateUseCase>();
        services.AddScoped<RestoreNotificationTemplateUseCase>();

        return services;
    }
}
