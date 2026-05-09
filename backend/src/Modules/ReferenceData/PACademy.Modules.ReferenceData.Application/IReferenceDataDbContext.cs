using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ReferenceData.Domain;

namespace PACademy.Modules.ReferenceData.Application;

/// <summary>
/// Application-layer abstraction over ReferenceDataDbContext.
/// </summary>
public interface IReferenceDataDbContext
{
    DbSet<ReferenceDataEntry> ReferenceDataEntries { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
