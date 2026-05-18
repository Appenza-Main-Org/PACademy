using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Payments.Application;
using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Infrastructure.Persistence;

public sealed class PaymentsDbContext(DbContextOptions<PaymentsDbContext> options)
    : DbContext(options), IPaymentsDbContext
{
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfigurationsFromAssembly(typeof(PaymentsDbContext).Assembly);

    Task<int> IPaymentsDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);

    Task<IDbContextTransaction> IPaymentsDbContext.BeginTransactionAsync(
        System.Data.IsolationLevel level, CancellationToken ct)
        => Database.BeginTransactionAsync(level, ct);
}
