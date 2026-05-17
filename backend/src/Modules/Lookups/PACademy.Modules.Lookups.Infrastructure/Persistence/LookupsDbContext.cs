using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Lookups.Application;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence;

public sealed class LookupsDbContext(DbContextOptions<LookupsDbContext> options)
    : DbContext(options), ILookupsDbContext
{
    public DbSet<LookupItemType> LookupItemTypes => Set<LookupItemType>();
    public DbSet<LookupItem> LookupItems => Set<LookupItem>();
    public DbSet<CategorySpecialization> CategorySpecializations => Set<CategorySpecialization>();
    public DbSet<CategoryCommittee> CategoryCommittees => Set<CategoryCommittee>();
    public DbSet<CategoryTest> CategoryTests => Set<CategoryTest>();
    public DbSet<PeriodCategory> PeriodCategories => Set<PeriodCategory>();

    public DbSet<ApplicantCategoryConfig> ApplicantCategoryConfigs => Set<ApplicantCategoryConfig>();
    public DbSet<ApplicantCategorySpecialization> ApplicantCategorySpecializations => Set<ApplicantCategorySpecialization>();
    public DbSet<ApplicantSpecializationYear> ApplicantSpecializationYears => Set<ApplicantSpecializationYear>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => modelBuilder.ApplyConfigurationsFromAssembly(typeof(LookupsDbContext).Assembly);

    Task<int> ILookupsDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
