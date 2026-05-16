using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T024 — CommitteeScoreThreshold HTTP integration tests.
/// Upsert PUT per committee, list all for cycle, 422 on min &gt; max.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class ScoreThresholdsIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly Guid CommitteeId1 = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid CommitteeId2 = Guid.Parse("10000000-0000-0000-0000-000000000002");

    [Fact]
    public async Task List_BeforeSetup_ReturnsEmptyList()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/score-thresholds");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeScoreThresholdDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Put_ValidThreshold_CreatesRow()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertScoreThresholdRequest(Min: 50, Max: 100);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeScoreThresholdDto>();
        dto.Should().NotBeNull();
        dto!.CycleId.Should().Be(cycleId);
        dto.CommitteeId.Should().Be(CommitteeId1);
        dto.Min.Should().Be(50);
        dto.Max.Should().Be(100);
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_AfterUpsert_ReturnsSavedThreshold()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold",
            new UpsertScoreThresholdRequest(Min: 60, Max: 90));

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeScoreThresholdDto>();
        dto!.Min.Should().Be(60);
        dto.Max.Should().Be(90);
    }

    [Fact]
    public async Task Get_UnknownCommittee_Returns404()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{Guid.NewGuid()}/score-threshold");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_MultipleCommittees_ReturnsAll()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold",
            new UpsertScoreThresholdRequest(Min: 40, Max: 80));
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId2}/score-threshold",
            new UpsertScoreThresholdRequest(Min: 50, Max: 90));

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/score-thresholds");

        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeScoreThresholdDto>>();
        items!.Should().HaveCount(2);
        items.Should().Contain(t => t.CommitteeId == CommitteeId1 && t.Min == 40);
        items.Should().Contain(t => t.CommitteeId == CommitteeId2 && t.Min == 50);
    }

    [Fact]
    public async Task Put_MinGreaterThanMax_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertScoreThresholdRequest(Min: 90, Max: 50); // invalid

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Put_NegativeMin_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertScoreThresholdRequest(Min: -1, Max: 100);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Put_SubsequentUpsert_UpdatesExistingRow()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold",
            new UpsertScoreThresholdRequest(Min: 50, Max: 100));

        var updateResp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/committees/{CommitteeId1}/score-threshold",
            new UpsertScoreThresholdRequest(Min: 70, Max: 95));

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await updateResp.Content.ReadFromJsonAsync<CommitteeScoreThresholdDto>();
        dto!.Min.Should().Be(70);
        dto.Max.Should().Be(95);
    }
}
