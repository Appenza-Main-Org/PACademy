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
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Applicants;

/// <summary>
/// T042 — FR-016 isolation: applicant in cycle A is not visible to admin
/// filtering by cycle B.
/// </summary>
[Collection("SqlServer")]
public sealed class CycleIsolationTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private Guid _cycleA;
    private Guid _cycleB;
    private Guid _applicantInA;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: true);
        await _factory.InitializeAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var cycles = await db.Cycles.AsNoTracking()
            .Where(c => c.DemoOrigin)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        _cycleA = cycles[0].Id;
        _cycleB = cycles[1].Id;

        // Insert one applicant into cycle A
        var applicantA = Applicant.Create(
            nationalId: "30001011177771",
            fullName: "مَتقدّم في الدورة الأولى",
            cycleId: _cycleA,
            createdBy: TestAuthHandler.DefaultTestUserId);
        db.Applicants.Add(applicantA);
        await db.SaveChangesAsync();
        _applicantInA = applicantA.Id;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task FilteringByCycleB_DoesNotReturnApplicantInCycleA()
    {
        var client = _factory.CreateClient();

        var resp = await client.GetAsync(
            $"/admin/applicants?cycleId={_cycleB}&pageSize=200");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var page = await resp.Content.ReadFromJsonAsync<PagedResult<ApplicantListItemDto>>();
        page!.Items.Should().NotContain(a => a.Id == _applicantInA);
        page.Items.Should().OnlyContain(a => a.CycleId == _cycleB);
    }

    [Fact]
    public async Task FilteringByCycleA_ReturnsApplicantInCycleA()
    {
        var client = _factory.CreateClient();

        var resp = await client.GetAsync(
            $"/admin/applicants?cycleId={_cycleA}&pageSize=200");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var page = await resp.Content.ReadFromJsonAsync<PagedResult<ApplicantListItemDto>>();
        page!.Items.Should().Contain(a => a.Id == _applicantInA);
    }
}
