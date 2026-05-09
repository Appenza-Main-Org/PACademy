using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Domain;
using System.Data;

namespace PACademy.Modules.Identity.Infrastructure.Persistence;

public sealed class IdentityDbContext(
    DbContextOptions<IdentityDbContext> options)
    : IdentityDbContext<SystemUser, IdentityRole<Guid>, Guid>(options),
      IIdentityDbContext
{
    public DbSet<Session> Sessions => Set<Session>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);
    }

    Task<IDbContextTransaction> IIdentityDbContext.BeginTransactionAsync(
        IsolationLevel isolationLevel, CancellationToken ct) =>
        Database.BeginTransactionAsync(isolationLevel, ct);

    Task<int> IIdentityDbContext.SaveChangesAsync(CancellationToken ct) =>
        base.SaveChangesAsync(ct);
}
