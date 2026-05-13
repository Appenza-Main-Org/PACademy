using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Application;

public interface ILookupsDbContext
{
    DbSet<LookupItemType> LookupItemTypes { get; }
    DbSet<LookupItem> LookupItems { get; }
    DbSet<CategorySpecialization> CategorySpecializations { get; }
    DbSet<CategoryCommittee> CategoryCommittees { get; }
    DbSet<CategoryTest> CategoryTests { get; }
    DbSet<PeriodCategory> PeriodCategories { get; }

    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
