using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Application;

public interface IPaymentsDbContext
{
    DbSet<Payment> Payments { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbContextTransaction> BeginTransactionAsync(
        System.Data.IsolationLevel level, CancellationToken ct = default);
}
