using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Identity.Domain;
using System.Data;

namespace PACademy.Modules.Identity.Application;

/// <summary>
/// Application-layer abstraction over the Identity DbContext.
/// Exposes only the DbSets the use cases need.
/// </summary>
public interface IIdentityDbContext
{
    DbSet<Session> Sessions { get; }
    DbSet<PendingOtp> PendingOtps { get; }
    DbSet<LockoutState> LockoutStates { get; }
    DbSet<LockPolicy> LockPolicies { get; }
    DbSet<SystemUser> SystemUsers { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default);
}
