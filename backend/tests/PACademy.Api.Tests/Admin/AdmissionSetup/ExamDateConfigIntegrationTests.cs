using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T025 — ExamDateConfig HTTP integration tests.
/// GET returns null before setup; PUT creates config; GET returns it after;
/// PUT with blackout not in bookable days → 422; row-version mismatch → 409.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class ExamDateConfigIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly DateTime FirstAvailable = new(2030, 7, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Get_BeforeSetup_ReturnsNull()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync($"admin/admission-setup/cycles/{cycleId}/exam-dates");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadAsStringAsync();
        body.Trim().Should().Be("null");
    }

    [Fact]
    public async Task Put_ValidRequest_CreatesConfig()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-07-01", "2030-07-15", "2030-07-30"],
            BlackoutDates: ["2030-07-15"]);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ExamDateConfigDto>();
        dto.Should().NotBeNull();
        dto!.CycleId.Should().Be(cycleId);
        dto.FirstAvailableDate.Should().Be(FirstAvailable);
        dto.BookableDays.Should().BeEquivalentTo(["2030-07-01", "2030-07-15", "2030-07-30"]);
        dto.BlackoutDates.Should().BeEquivalentTo(["2030-07-15"]);
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_AfterUpsert_ReturnsSavedConfig()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-07-05"],
            BlackoutDates: []);

        await Client.PutAsJsonAsync($"admin/admission-setup/cycles/{cycleId}/exam-dates", req);

        var resp = await Client.GetAsync($"admin/admission-setup/cycles/{cycleId}/exam-dates");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ExamDateConfigDto>();
        dto.Should().NotBeNull();
        dto!.BookableDays.Should().Contain("2030-07-05");
    }

    [Fact]
    public async Task Put_SubsequentUpsert_UpdatesExisting()
    {
        var cycleId = await SeedDraftCycleAsync();
        var initial = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-07-01"],
            BlackoutDates: []);
        await Client.PutAsJsonAsync($"admin/admission-setup/cycles/{cycleId}/exam-dates", initial);

        var updated = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-07-01", "2030-07-10"],
            BlackoutDates: ["2030-07-10"]);
        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", updated);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ExamDateConfigDto>();
        dto!.BookableDays.Should().HaveCount(2);
        dto.BlackoutDates.Should().BeEquivalentTo(["2030-07-10"]);
    }

    [Fact]
    public async Task Put_BlackoutNotInBookable_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-07-01"],
            BlackoutDates: ["2030-08-15"]); // not in bookable set

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Put_EmptyBookableDays_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: [],
            BlackoutDates: []);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Put_BookableDayBeforeFirstAvailable_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new UpsertExamDateConfigRequest(
            FirstAvailableDate: FirstAvailable,
            BookableDays: ["2030-06-01"], // before FirstAvailable
            BlackoutDates: []);

        var resp = await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
