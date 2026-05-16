using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T068 — AdminCycleExamsController HTTP integration tests (contracts §8).
/// List, Create, Update, Reorder, Archive, Restore happy paths.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class CycleExamPlanIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    [Fact]
    public async Task List_BeforeCreation_ReturnsEmpty()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync($"admin/cycles/{cycleId}/exam-plan");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<CycleExamDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateCycleExamRequest("written", Order: 10, IsRequired: true);

        var resp = await Client.PostAsJsonAsync(
            $"admin/cycles/{cycleId}/exam-plan", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<CycleExamDto>();
        dto.Should().NotBeNull();
        dto!.ExamTypeKey.Should().Be("written");
        dto.Order.Should().Be(10);
        dto.IsRequired.Should().BeTrue();
        dto.IsArchived.Should().BeFalse();
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task List_AfterCreate_ReturnsSortedByOrder()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsJsonAsync($"admin/cycles/{cycleId}/exam-plan",
            new CreateCycleExamRequest("physical", Order: 20, IsRequired: false));
        await Client.PostAsJsonAsync($"admin/cycles/{cycleId}/exam-plan",
            new CreateCycleExamRequest("written", Order: 10, IsRequired: true));

        var resp = await Client.GetAsync($"admin/cycles/{cycleId}/exam-plan");

        var items = await resp.Content.ReadFromJsonAsync<List<CycleExamDto>>();
        items!.Should().HaveCount(2);
        items[0].Order.Should().BeLessThan(items[1].Order,
            "list must be sorted ascending by order");
        items[0].ExamTypeKey.Should().Be("written");
    }

    [Fact]
    public async Task Update_Order_Returns200()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateExamAsync(cycleId, "sports", 30);
        var req = new UpdateCycleExamRequest(
            Order: 50, IsRequired: null, FeeEgp: null, RowVersion: created.RowVersion);

        var resp = await Client.PatchAsJsonAsync(
            $"admin/cycle-exams/{created.Id}", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CycleExamDto>();
        dto!.Order.Should().Be(50);
    }

    [Fact]
    public async Task Reorder_ChangesOrderToMultiplesOf10()
    {
        var cycleId = await SeedDraftCycleAsync();
        var e1 = await CreateExamAsync(cycleId, "written_r", 10);
        var e2 = await CreateExamAsync(cycleId, "physical_r", 20);
        var e3 = await CreateExamAsync(cycleId, "sports_r", 30);

        // Reorder: put e3 first, then e1, then e2
        var req = new ReorderCycleExamsRequest([e3.Id, e1.Id, e2.Id]);
        var resp = await Client.PostAsJsonAsync(
            $"admin/cycles/{cycleId}/exam-plan/reorder", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<CycleExamDto>>();
        items!.Should().HaveCount(3);
        var sorted = items.OrderBy(x => x.Order).ToList();
        sorted[0].Id.Should().Be(e3.Id);
        sorted[0].Order.Should().Be(10);
        sorted[1].Id.Should().Be(e1.Id);
        sorted[1].Order.Should().Be(20);
        sorted[2].Id.Should().Be(e2.Id);
        sorted[2].Order.Should().Be(30);
    }

    [Fact]
    public async Task Archive_ExistingExam_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var exam = await CreateExamAsync(cycleId, "archive_exam", 10);

        var resp = await Client.PostAsJsonAsync(
            $"admin/cycle-exams/{exam.Id}/archive",
            new { reason = "لا يلزم" });

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Restore_ArchivedExam_Returns200()
    {
        var cycleId = await SeedDraftCycleAsync();
        var exam = await CreateExamAsync(cycleId, "restore_exam", 10);
        await Client.PostAsJsonAsync($"admin/cycle-exams/{exam.Id}/archive",
            new { reason = "test" });

        var resp = await Client.PostAsync(
            $"admin/cycle-exams/{exam.Id}/restore", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CycleExamDto>();
        dto!.IsArchived.Should().BeFalse();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<CycleExamDto> CreateExamAsync(
        Guid cycleId, string examTypeKey, int order)
    {
        var resp = await Client.PostAsJsonAsync(
            $"admin/cycles/{cycleId}/exam-plan",
            new CreateCycleExamRequest(examTypeKey, order, IsRequired: true));
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CycleExamDto>())!;
    }
}
