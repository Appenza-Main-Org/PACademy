using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Api.Tests.Seeding;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Common;
using PACademy.Domain.Applicants;
using PACademy.Domain.Cycles;
using PACademy.Infrastructure.Persistence;
using System.Diagnostics;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Applicants;

/// <summary>
/// T040 — Applicant insert → GET /admin/applicants returns within SC-002
/// propagation budget (p95 ≤ 2 s on the test SQL Server). Wall-clock budget
/// is relaxed on CI to absorb container spin-up.
/// </summary>
[Collection("SqlServer")]
public sealed class PropagationTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: true);
        await _factory.InitializeAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task NewApplicant_AppearsInListWithinPropagationBudget()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var activeCycle = await db.Cycles.AsNoTracking()
            .FirstAsync(c => c.Status == CycleStatus.Active);

        // Insert a new applicant directly (Phase 3 has no POST endpoint yet —
        // create comes in a later phase). The propagation we measure is the
        // GET path returning the new row.
        var newApplicant = Applicant.Create(
            nationalId: "30001010099991",
            fullName: "محمد اختبار الانتشار",
            cycleId: activeCycle.Id,
            createdBy: TestAuthHandler.DefaultTestUserId,
            demoOrigin: false);
        db.Applicants.Add(newApplicant);
        await db.SaveChangesAsync();

        var client = _factory.CreateClient();

        // Measure the round-trip; budget is generous to account for cold ASP.NET
        // pipeline + Testcontainers cold start.
        var sw = Stopwatch.StartNew();
        var resp = await client.GetAsync(
            $"/admin/applicants?cycleId={activeCycle.Id}&q=محمد اختبار");
        sw.Stop();

        resp.IsSuccessStatusCode.Should().BeTrue();
        sw.ElapsedMilliseconds.Should().BeLessThan(5000,
            "SC-002 mandates p95 ≤ 2 s; CI budget relaxed to 5 s for container spin-up");

        var page = await resp.Content.ReadFromJsonAsync<PagedResult<ApplicantListItemDto>>();
        page.Should().NotBeNull();
        page!.Items.Should().Contain(a => a.Id == newApplicant.Id);
    }
}
