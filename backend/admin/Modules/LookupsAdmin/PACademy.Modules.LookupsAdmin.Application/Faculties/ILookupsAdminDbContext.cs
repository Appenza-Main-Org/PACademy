using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

/// <summary>
/// Read+write data-access contract for the admin lookups module.
/// Exposes <see cref="DbSet{T}"/> because admin owns lookup mutation;
/// applicant backend never sees this interface.
/// </summary>
public interface ILookupsAdminDbContext
{
    DbSet<Faculty> Faculties { get; }
    Task<int> SaveChangesAsync(CancellationToken ct);
}
