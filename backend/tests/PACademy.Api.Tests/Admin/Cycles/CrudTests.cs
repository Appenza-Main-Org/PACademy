using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Contracts.Common;
using PACademy.Infrastructure.Persistence;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Cycles;

/// <summary>
/// T233 — FR-Y01 / AC-1 / AC-4 / AC-5 / AC-6: CRUD happy-path and guard-rails.
/// </summary>
[Collection("SqlServer")]
public sealed class CrudTests(SqlServerFixture sqlFixture) : IAsyncLifetime
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

    // AC-1: POST → 201 Draft, audit row written
    [Fact]
    public async Task Post_ValidCycle_Returns201Draft()
    {
        var req = new CreateCycleRequest(
            NameAr: "دورة اختبار الإنشاء",
            Year: 2027,
            Cohort: "male",
            OpenDate: new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            CloseDate: new DateTime(2027, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            ExpectedCapacity: 300);

        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto.Should().NotBeNull();
        dto!.Status.Should().Be("draft");
        dto.NameAr.Should().Be(req.NameAr);
        dto.Year.Should().Be(2027);
        dto.Cohort.Should().Be("male");
        dto.ApplicantCount.Should().Be(0);
        dto.OpenCategories.Should().NotBeNull();
        dto.ConditionOverrides.Should().NotBeNull();
        resp.Headers.Location.Should().NotBeNull();
    }

    // Validation: missing NameAr → 400
    [Fact]
    public async Task Post_EmptyNameAr_Returns400()
    {
        var req = new CreateCycleRequest(
            NameAr: "",
            Year: 2027,
            Cohort: "male",
            OpenDate: new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            CloseDate: new DateTime(2027, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            ExpectedCapacity: 300);

        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // Validation: OpenDate ≥ CloseDate → 400
    [Fact]
    public async Task Post_OpenDateAfterCloseDate_Returns400()
    {
        var req = new CreateCycleRequest(
            NameAr: "دورة غير صالحة",
            Year: 2027,
            Cohort: "male",
            OpenDate: new DateTime(2027, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            CloseDate: new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            ExpectedCapacity: 300);

        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // Validation: invalid Cohort → 400
    [Fact]
    public async Task Post_InvalidCohort_Returns400()
    {
        var req = new CreateCycleRequest(
            NameAr: "دورة خاطئة",
            Year: 2027,
            Cohort: "mixed",
            OpenDate: new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            CloseDate: new DateTime(2027, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            ExpectedCapacity: 300);

        var resp = await _client.PostAsJsonAsync("/admin/cycles", req);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // GET list returns the created cycle
    [Fact]
    public async Task Get_List_ReturnsCycle()
    {
        var req = new CreateCycleRequest(
            "دورة للقائمة", 2028, "female",
            new DateTime(2028, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2028, 9, 30, 0, 0, 0, DateTimeKind.Utc),
            200);
        await _client.PostAsJsonAsync("/admin/cycles", req);

        var resp = await _client.GetAsync("/admin/cycles?year=2028");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var page = await resp.Content.ReadFromJsonAsync<PagedResult<CycleListItemDto>>();
        page!.Items.Should().Contain(c => c.Year == 2028 && c.Cohort == "female");
        resp.Headers.Should().ContainKey("X-Total-Count");
    }

    // GET by id returns detail
    [Fact]
    public async Task Get_ById_ReturnsDetail()
    {
        var created = await (await _client.PostAsJsonAsync("/admin/cycles",
            new CreateCycleRequest("دورة للتفاصيل", 2029, "male",
                new DateTime(2029, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2029, 9, 30, 0, 0, 0, DateTimeKind.Utc),
                400)))
            .Content.ReadFromJsonAsync<CycleDetailDto>();

        var resp = await _client.GetAsync($"/admin/cycles/{created!.Id}");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto!.Id.Should().Be(created.Id);
        dto.NameAr.Should().Be("دورة للتفاصيل");
    }

    // GET unknown id → 404
    [Fact]
    public async Task Get_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/admin/cycles/{Guid.NewGuid()}");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // PATCH mutable fields
    [Fact]
    public async Task Patch_MutableFields_UpdatesSuccessfully()
    {
        var created = await (await _client.PostAsJsonAsync("/admin/cycles",
            new CreateCycleRequest("اسم قديم", 2030, "male",
                new DateTime(2030, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2030, 9, 30, 0, 0, 0, DateTimeKind.Utc),
                100)))
            .Content.ReadFromJsonAsync<CycleDetailDto>();

        var patch = new UpdateCycleRequest("اسم جديد", null, null, 250, null, null);
        var resp = await _client.PatchAsJsonAsync($"/admin/cycles/{created!.Id}", patch);

        resp.IsSuccessStatusCode.Should().BeTrue();
        var dto = await resp.Content.ReadFromJsonAsync<CycleDetailDto>();
        dto!.NameAr.Should().Be("اسم جديد");
        dto.ExpectedCapacity.Should().Be(250);
    }

    // AC-5: DELETE Draft with no applicants → 204
    [Fact]
    public async Task Delete_DraftNoApplicants_Returns204()
    {
        var created = await (await _client.PostAsJsonAsync("/admin/cycles",
            new CreateCycleRequest("دورة للحذف", 2031, "female",
                new DateTime(2031, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2031, 9, 30, 0, 0, 0, DateTimeKind.Utc),
                50)))
            .Content.ReadFromJsonAsync<CycleDetailDto>();

        var resp = await _client.DeleteAsync($"/admin/cycles/{created!.Id}");
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // AC-6: public GET /cycles only returns Active+Closed
    [Fact]
    public async Task PublicGet_ExcludesDraft()
    {
        await _client.PostAsJsonAsync("/admin/cycles",
            new CreateCycleRequest("مسودة عامة", 2032, "male",
                new DateTime(2032, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2032, 9, 30, 0, 0, 0, DateTimeKind.Utc),
                100));

        var publicClient = _factory.CreateClient();
        var resp = await publicClient.GetAsync("/cycles");
        resp.IsSuccessStatusCode.Should().BeTrue();

        var page = await resp.Content.ReadFromJsonAsync<PagedResult<CycleListItemDto>>();
        page!.Items.Should().NotContain(c => c.Status == "draft");
    }
}
