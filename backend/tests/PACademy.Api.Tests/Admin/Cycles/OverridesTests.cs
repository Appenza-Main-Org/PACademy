using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Infrastructure.Persistence;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace PACademy.Api.Tests.Admin.Cycles;

/// <summary>
/// T235 — FR-Y04 / AC-4 / AC-5: openCategories + conditionOverrides PATCH;
/// AC-5 DELETE guard with applicants.
/// </summary>
[Collection("SqlServer")]
public sealed class OverridesTests(SqlServerFixture sqlFixture) : IAsyncLifetime
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

    private async Task<CycleDetailDto> CreateAsync(string nameAr, int year)
    {
        var req = new CreateCycleRequest(
            nameAr, year, "male",
            new DateTime(year, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(year, 9, 30, 0, 0, 0, DateTimeKind.Utc),
            200);
        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CycleDetailDto>())!;
    }

    // AC-4: PATCH openCategories → detail reflects change
    [Fact]
    public async Task Patch_OpenCategories_ReflectedInDetail()
    {
        var cycle = await CreateAsync("دورة الفئات", 2060);

        var openCats = new Dictionary<string, OpenCategoryEntryDto>
        {
            ["police"] = new OpenCategoryEntryDto(IsOpen: true, Capacity: 150, Notes: null),
            ["forensics"] = new OpenCategoryEntryDto(IsOpen: false, Capacity: null, Notes: null),
        };

        var patch = new UpdateCycleRequest(null, null, null, null, openCats, null);
        var patchResp = await _client.PatchAsJsonAsync($"/admin/cycles/{cycle.Id}", patch);
        patchResp.IsSuccessStatusCode.Should().BeTrue();

        var updated = await patchResp.Content.ReadFromJsonAsync<CycleDetailDto>();
        updated!.OpenCategories.Should().ContainKey("police");
        updated.OpenCategories["police"].IsOpen.Should().BeTrue();
        updated.OpenCategories["police"].Capacity.Should().Be(150);
        updated.OpenCategories.Should().ContainKey("forensics");
        updated.OpenCategories["forensics"].IsOpen.Should().BeFalse();
    }

    // PATCH conditionOverrides round-trips as JSON
    [Fact]
    public async Task Patch_ConditionOverrides_RoundTrips()
    {
        var cycle = await CreateAsync("دورة الشروط", 2061);

        var overrides = new Dictionary<string, JsonElement>
        {
            ["police"] = JsonSerializer.SerializeToElement(new { minAge = 18, maxAge = 24 }),
        };

        var patch = new UpdateCycleRequest(null, null, null, null, null, overrides);
        var resp = await _client.PatchAsJsonAsync($"/admin/cycles/{cycle.Id}", patch);
        resp.IsSuccessStatusCode.Should().BeTrue();

        var updated = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        updated!.ConditionOverrides.Should().ContainKey("police");
    }

    // AC-5: DELETE with applicants → 422 CYCLE_HAS_APPLICANTS
    [Fact]
    public async Task Delete_WithApplicants_Returns422()
    {
        var cycle = await CreateAsync("دورة بمتقدمين", 2062);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        db.Applicants.Add(Domain.Applicants.Applicant.Create(
            nationalId: "30001011100001",
            fullName: "متقدم اختبار الحذف",
            cycleId: cycle.Id,
            createdBy: TestAuthHandler.DefaultTestUserId));
        await db.SaveChangesAsync();

        var resp = await _client.DeleteAsync($"/admin/cycles/{cycle.Id}");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("CYCLE_HAS_APPLICANTS");
    }

    // DELETE non-Draft → 422 INVALID_CYCLE_TRANSITION
    [Fact]
    public async Task Delete_NonDraft_Returns422()
    {
        // Use a unique far-future year to avoid (year, cohort) index conflicts with other tests
        var req = new CreateCycleRequest(
            "دورة نشطة للحذف", 2064, "female",
            DateTime.UtcNow.AddDays(-1),   // window includes now
            DateTime.UtcNow.AddDays(90),
            50);
        var createResp = await _client.PostAsJsonAsync("/admin/cycles", req);
        createResp.EnsureSuccessStatusCode();
        var cycle = (await createResp.Content.ReadFromJsonAsync<CycleDetailDto>())!;

        var activateResp = await _client.PostAsJsonAsync(
            $"/admin/cycles/{cycle.Id}/status",
            new TransitionCycleStatusRequest("active"));
        activateResp.EnsureSuccessStatusCode();

        var resp = await _client.DeleteAsync($"/admin/cycles/{cycle.Id}");
        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
