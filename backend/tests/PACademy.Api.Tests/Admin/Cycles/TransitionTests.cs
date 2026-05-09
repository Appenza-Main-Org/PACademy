using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Infrastructure.Persistence;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Cycles;

/// <summary>
/// T234 — FR-Y02 / FR-Y03 / AC-2 / AC-3: status transition rules.
/// </summary>
[Collection("SqlServer")]
public sealed class TransitionTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: false);
        await _factory.InitializeAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        await db.Database.MigrateAsync();

        _client = _factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Test-Role", "super_admin");
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }

    private async Task<CycleDetailDto> CreateCycleAsync(
        string nameAr, int year, string cohort,
        DateTime openDate, DateTime closeDate)
    {
        var req = new CreateCycleRequest(nameAr, year, cohort, openDate, closeDate, 100);
        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CycleDetailDto>())!;
    }

    private Task<HttpResponseMessage> TransitionAsync(Guid id, string newStatus)
        => _client.PostAsJsonAsync($"/admin/cycles/{id}/status",
            new TransitionCycleStatusRequest(newStatus));

    // INVALID_CYCLE_TRANSITION: Draft → Closed (skip)
    [Fact]
    public async Task Transition_DraftToClosed_Returns422()
    {
        var cycle = await CreateCycleAsync("تخطي حالة", 2040, "male",
            DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(60));

        var resp = await TransitionAsync(cycle.Id, "closed");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("INVALID_CYCLE_TRANSITION");
    }

    // INVALID_CYCLE_TRANSITION: Active → Draft (reverse)
    [Fact]
    public async Task Transition_ActiveToDraft_Returns422()
    {
        var cycle = await CreateCycleAsync("عكس الحالة", 2041, "male",
            DateTime.UtcNow.AddDays(-5), DateTime.UtcNow.AddDays(90));

        await TransitionAsync(cycle.Id, "active");

        var resp = await TransitionAsync(cycle.Id, "draft");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("INVALID_CYCLE_TRANSITION");
    }

    // ACTIVATION_OUT_OF_WINDOW: now < openDate → 422 FR-Y03
    [Fact]
    public async Task Transition_ActivateBeforeWindow_Returns422()
    {
        var cycle = await CreateCycleAsync("قبل النافذة", 2042, "male",
            DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(90));

        var resp = await TransitionAsync(cycle.Id, "active");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("ACTIVATION_OUT_OF_WINDOW");
    }

    // ACTIVATION_OUT_OF_WINDOW: now > closeDate → 422 FR-Y03
    [Fact]
    public async Task Transition_ActivateAfterWindow_Returns422()
    {
        var cycle = await CreateCycleAsync("بعد النافذة", 2043, "male",
            DateTime.UtcNow.AddDays(-90), DateTime.UtcNow.AddDays(-5));

        var resp = await TransitionAsync(cycle.Id, "active");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("ACTIVATION_OUT_OF_WINDOW");
    }

    // AC-2: Draft → Active within window succeeds (FR-Y02 uniqueness respected)
    [Fact]
    public async Task Transition_DraftToActive_WithinWindow_Succeeds()
    {
        var cycle = await CreateCycleAsync("تفعيل صالح", 2044, "female",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(60));

        var resp = await TransitionAsync(cycle.Id, "active");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto!.Status.Should().Be("active");
    }

    // OVERLAPPING_ACTIVE_CYCLE: activating second cycle for same (year, cohort) → 422 FR-Y02
    [Fact]
    public async Task Transition_SecondActiveForSameYearCohort_Returns422()
    {
        var year = 2045;
        var c1 = await CreateCycleAsync("الأولى", year, "male",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(60));
        var c2 = await CreateCycleAsync("الثانية", year, "male",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(60));

        await TransitionAsync(c1.Id, "active");

        var resp = await TransitionAsync(c2.Id, "active");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("OVERLAPPING_ACTIVE_CYCLE");
    }

    // AC-3: Active → Closed; cycle transitions correctly
    [Fact]
    public async Task Transition_ActiveToClosed_Succeeds()
    {
        var cycle = await CreateCycleAsync("إغلاق الدورة", 2046, "female",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(60));

        await TransitionAsync(cycle.Id, "active");

        var resp = await TransitionAsync(cycle.Id, "closed");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto!.Status.Should().Be("closed");
    }

    // Closed → Archived succeeds
    [Fact]
    public async Task Transition_ClosedToArchived_Succeeds()
    {
        var cycle = await CreateCycleAsync("أرشفة الدورة", 2047, "male",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(60));

        await TransitionAsync(cycle.Id, "active");
        await TransitionAsync(cycle.Id, "closed");

        var resp = await TransitionAsync(cycle.Id, "archived");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto!.Status.Should().Be("archived");
        dto.ArchivedAt.Should().NotBeNull();
    }
}
