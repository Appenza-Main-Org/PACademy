using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Modules.Payments.Application;
using PACademy.Modules.Payments.Application.Payments;
using PACademy.Modules.Payments.Infrastructure.Persistence;
using PACademy.Modules.Payments.Public;

namespace PACademy.Modules.Payments.Infrastructure;

public static class PaymentsModule
{
    public static IServiceCollection AddPaymentsModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<PaymentsDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsHistoryTable("__EFMigrationsHistory_Payments")
                       .MigrationsAssembly(typeof(PaymentsDbContext).Assembly.FullName)));

        services.AddScoped<IPaymentsDbContext>(sp => sp.GetRequiredService<PaymentsDbContext>());
        services.AddScoped<IPaymentsApi, PaymentsApiService>();

        // Use cases
        services.AddScoped<ListPaymentsUseCase>();
        services.AddScoped<GetPaymentByReferenceUseCase>();
        services.AddScoped<SyncPaymentStatusUseCase>();
        services.AddScoped<SetPaymentStatusUseCase>();
        services.AddScoped<RefundPaymentUseCase>();
        services.AddScoped<ListRefundEligiblePaymentsUseCase>();

        return services;
    }
}
