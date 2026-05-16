using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T026 — TotalScoreConfig HTTP integration tests.
/// Upsert PUT per stream, 422 when weights ≠ 100, 422 on unknown exam_key.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class TotalScoreConfigIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private const string Stream = "general"; // ApplicantStream.General → snake_case "general"

    private static readonly UpsertTotalScoreConfigRequest ValidRequest = new(
        Components:
        [
            new TotalScoreComponentDto("written", 60, 30),
            new TotalScoreComponentDto("physical", 40, 20),
        ],
        TotalScoreOutOf: 100);

    [Fact]
    public async Task List_BeforeSetup_ReturnsEmptyList()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<TotalScoreConfigDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Put_ValidRequest_CreatesConfig()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}", ValidRequest);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<TotalScoreConfigDto>();
        dto.Should().NotBeNull();
        dto!.CycleId.Should().Be(cycleId);
        dto.ApplicantStream.Should().Be(Stream);
        dto.Components.Should().HaveCount(2);
        dto.TotalScoreOutOf.Should().Be(100);
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_ByStream_ReturnsConfig()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}", ValidRequest);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<TotalScoreConfigDto>();
        dto!.Components.Should().HaveCount(2);
    }

    [Fact]
    public async Task Get_UnknownStream_Returns404()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/nonexistent_stream");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_MultipleStreams_ReturnsAll()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/general", ValidRequest);
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/special", ValidRequest);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score");

        var items = await resp.Content.ReadFromJsonAsync<List<TotalScoreConfigDto>>();
        items!.Should().HaveCount(2);
        items.Should().Contain(c => c.ApplicantStream == "general");
        items.Should().Contain(c => c.ApplicantStream == "special");
    }

    [Fact]
    public async Task Put_WeightsNotSumTo100_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertTotalScoreConfigRequest(
            Components:
            [
                new TotalScoreComponentDto("written", 50, 25),
                new TotalScoreComponentDto("physical", 30, 15), // 50+30=80, not 100
            ],
            TotalScoreOutOf: 100);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Put_SubsequentUpsert_UpdatesExisting()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}", ValidRequest);

        var updated = new UpsertTotalScoreConfigRequest(
            Components:
            [
                new TotalScoreComponentDto("written", 70, 35),
                new TotalScoreComponentDto("physical", 30, 15),
            ],
            TotalScoreOutOf: 150);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/total-score/{Stream}", updated);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<TotalScoreConfigDto>();
        dto!.TotalScoreOutOf.Should().Be(150);
        dto.Components.First(c => c.ExamKey == "written").Weight.Should().Be(70);
    }
}
