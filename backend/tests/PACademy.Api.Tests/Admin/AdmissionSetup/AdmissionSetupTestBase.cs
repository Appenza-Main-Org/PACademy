using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Base class providing shared setup helpers for admission-setup integration tests.
/// </summary>
public abstract class AdmissionSetupTestBase(AdmissionSetupFixture fixture) : IAsyncLifetime
{
    protected AdmissionSetupApiFactory Factory = null!;
    protected HttpClient Client = null!;

    protected static readonly Guid TestActorId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public virtual async Task InitializeAsync()
    {
        Factory = new AdmissionSetupApiFactory(fixture);
        Client = Factory.CreateRoleClient("super_admin");
        await Task.CompletedTask;
    }

    public virtual Task DisposeAsync()
    {
        Client.Dispose();
        Factory.Dispose();
        return Task.CompletedTask;
    }

    /// <summary>Seeds a Draft cycle directly into AdmissionsDbContext and returns its Id.</summary>
    protected async Task<Guid> SeedDraftCycleAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AdmissionsDbContext>();

        var cycle = Cycle.Create(
            nameAr: $"دورة اختبار {Guid.NewGuid():N}",
            year: 2030,
            cohort: "male",
            openDate: new DateTime(2030, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            closeDate: new DateTime(2030, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            createdBy: TestActorId,
            status: CycleStatus.Draft);

        db.Cycles.Add(cycle);
        await db.SaveChangesAsync();
        return cycle.Id;
    }
}
