using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsRead.Application;

/// <summary>
/// Read-only data-access surface the applicant backend uses against
/// the shared lookup tables.
///
/// IQueryable, NOT DbSet — applicant backend has no compile-time path
/// to call Add/Update/Remove. Lookup mutation lives exclusively in the
/// admin backend's LookupsAdmin module.
/// </summary>
public interface ILookupsReadDbContext
{
    IQueryable<Faculty> Faculties { get; }
}
