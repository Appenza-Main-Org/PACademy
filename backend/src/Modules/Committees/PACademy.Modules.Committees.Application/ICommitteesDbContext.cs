using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Application;

public interface ICommitteesDbContext
{
    DbSet<Committee> Committees { get; }
    DbSet<CommitteeMember> CommitteeMembers { get; }
    DbSet<CommitteeDateBinding> CommitteeDateBindings { get; }
    DbSet<CommitteeSpecialization> CommitteeSpecializations { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
