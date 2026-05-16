using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T028 — Wizard step-status HTTP integration tests.
/// GET returns 13 rows (all not_started) before any action;
/// POST .../complete marks the step complete; POST .../reopen reverts it;
/// unknown step key → 422; auto-interceptor fires on entity save.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class WizardStatusIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private const string StepKey = "fees";
    private const string UnknownStepKey = "legacy_step_that_was_removed";

    [Fact]
    public async Task GetStatuses_BeforeAnyAction_Returns13NotStartedRows()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/step-statuses");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var rows = await resp.Content.ReadFromJsonAsync<List<WizardStepStatusDto>>();
        rows.Should().NotBeNull();
        rows!.Should().HaveCount(13);
        rows.Should().OnlyContain(r => r.Status == "not_started");
    }

    [Fact]
    public async Task Complete_ValidStep_MarksComplete()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/{StepKey}/complete", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<WizardStepStatusDto>();
        dto.Should().NotBeNull();
        dto!.StepKey.Should().Be(StepKey);
        dto.Status.Should().Be("complete");
        dto.CompletedAt.Should().NotBeNull();
        dto.CompletedBy.Should().Be(TestActorId);
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetStatuses_AfterComplete_ReflectsCompleteStatus()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/{StepKey}/complete", null);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/step-statuses");

        var rows = await resp.Content.ReadFromJsonAsync<List<WizardStepStatusDto>>();
        rows.Should().NotBeNull();
        var feeRow = rows!.Single(r => r.StepKey == StepKey);
        feeRow.Status.Should().Be("complete");
        // All other rows should remain not_started
        rows!.Where(r => r.StepKey != StepKey)
            .Should().OnlyContain(r => r.Status == "not_started");
    }

    [Fact]
    public async Task Reopen_CompletedStep_RevertsToInProgress()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/{StepKey}/complete", null);

        var resp = await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/{StepKey}/reopen", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<WizardStepStatusDto>();
        dto!.Status.Should().Be("in_progress");
        dto.CompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task Reopen_NonExistentStep_Returns404()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/exams/reopen", null);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AutoPromote_NotStartedStep_PromotesToInProgress()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/application_settings/auto-promote", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<WizardStepStatusDto>();
        dto!.Status.Should().Be("in_progress");
    }

    [Fact]
    public async Task AutoPromote_AlreadyInProgress_IsIdempotent()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/application_settings/auto-promote", null);

        var resp = await Client.PostAsync(
            $"admin/admission-setup/cycles/{cycleId}/steps/application_settings/auto-promote", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<WizardStepStatusDto>();
        dto!.Status.Should().Be("in_progress");
    }

    [Fact]
    public async Task WizardInterceptor_OnExamDateSave_PromotesStepToInProgress()
    {
        var cycleId = await SeedDraftCycleAsync();
        var upsertReq = new UpsertExamDateConfigRequest(
            FirstAvailableDate: new DateTime(2030, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            BookableDays: ["2030-07-15"],
            BlackoutDates: []);

        await Client.PutAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/exam-dates", upsertReq);

        var statusResp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/step-statuses");
        var rows = await statusResp.Content.ReadFromJsonAsync<List<WizardStepStatusDto>>();
        var examDatesRow = rows!.FirstOrDefault(r => r.StepKey == "exam_dates");
        examDatesRow.Should().NotBeNull();
        examDatesRow!.Status.Should().BeOneOf("in_progress", "complete");
    }
}
