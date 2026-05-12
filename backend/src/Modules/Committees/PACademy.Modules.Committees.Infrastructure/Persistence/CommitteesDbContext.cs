using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Application;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Infrastructure.Persistence;

public sealed class CommitteesDbContext(DbContextOptions<CommitteesDbContext> options)
    : DbContext(options), ICommitteesDbContext
{
    public DbSet<Committee> Committees => Set<Committee>();
    public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
    public DbSet<CommitteeDateBinding> CommitteeDateBindings => Set<CommitteeDateBinding>();
    public DbSet<CommitteeSpecialization> CommitteeSpecializations => Set<CommitteeSpecialization>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfigurationsFromAssembly(typeof(CommitteesDbContext).Assembly);

    Task<int> ICommitteesDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
