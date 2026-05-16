using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T027 — ElectronicDeclaration HTTP integration tests.
/// POST creates draft v1; subsequent POST creates v2; Publish atomically
/// demotes prior published version; Archive blocks published versions.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class ElectronicDeclarationIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly DateTime Effective = new(2030, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task GetPublished_BeforeAnyDeclaration_ReturnsNull()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadAsStringAsync();
        body.Trim().Should().Be("null");
    }

    [Fact]
    public async Task Post_FirstDraft_CreatesVersion1()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateDeclarationRequest(
            BodyAr: "نص الإقرار الأول",
            EffectiveFrom: Effective);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        dto.Should().NotBeNull();
        dto!.CycleId.Should().Be(cycleId);
        dto.BodyAr.Should().Be("نص الإقرار الأول");
        dto.Version.Should().Be(1);
        dto.PublishedAt.Should().BeNull();
        dto.IsArchived.Should().BeFalse();
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Post_SecondDraft_CreatesVersion2()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("الإصدار الأول", Effective));

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("الإصدار الثاني", Effective));

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        dto!.Version.Should().Be(2);
        dto.BodyAr.Should().Be("الإصدار الثاني");
    }

    [Fact]
    public async Task ListVersions_ReturnsAllVersions()
    {
        var cycleId = await SeedDraftCycleAsync();
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("v1", Effective));
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("v2", Effective));

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration/versions");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var versions = await resp.Content.ReadFromJsonAsync<List<ElectronicDeclarationDto>>();
        versions!.Should().HaveCount(2);
    }

    [Fact]
    public async Task Publish_DraftDeclaration_SetsPublishedAt()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("نص للنشر", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();

        var resp = await Client.PostAsync(
            $"admin/admission-setup/declaration/{draft!.Id}/publish", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        dto!.PublishedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetPublished_AfterPublish_ReturnsPublishedDeclaration()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("المنشور", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        await Client.PostAsync($"admin/admission-setup/declaration/{draft!.Id}/publish", null);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        dto!.PublishedAt.Should().NotBeNull();
        dto.BodyAr.Should().Be("المنشور");
    }

    [Fact]
    public async Task Publish_SecondDraft_DemotesPriorPublished()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft1 = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("v1", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        await Client.PostAsync($"admin/admission-setup/declaration/{draft1!.Id}/publish", null);

        var draft2 = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("v2", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        await Client.PostAsync($"admin/admission-setup/declaration/{draft2!.Id}/publish", null);

        // v2 should now be the published one
        var currentResp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration");
        var current = await currentResp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        current!.Version.Should().Be(2);

        // v1 should no longer be published (demoted by atomic flip)
        var versions = await (await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration/versions"))
            .Content.ReadFromJsonAsync<List<ElectronicDeclarationDto>>();
        var v1 = versions!.Single(v => v.Version == 1);
        v1.PublishedAt.Should().BeNull();
    }

    [Fact]
    public async Task Archive_PublishedDeclaration_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("منشور", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        await Client.PostAsync($"admin/admission-setup/declaration/{draft!.Id}/publish", null);

        var resp = await Client.PostAsync(
            $"admin/admission-setup/declaration/{draft.Id}/archive", null);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Archive_UnpublishedDraft_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("مسودة", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();

        var resp = await Client.PostAsync(
            $"admin/admission-setup/declaration/{draft!.Id}/archive", null);

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Update_DraftDeclaration_UpdatesBody()
    {
        var cycleId = await SeedDraftCycleAsync();
        var draft = await (await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/declaration",
            new CreateDeclarationRequest("نص أولي", Effective)))
            .Content.ReadFromJsonAsync<ElectronicDeclarationDto>();

        var updateReq = new UpdateDeclarationRequest(
            BodyAr: "نص محدث",
            EffectiveFrom: null,
            RowVersion: draft!.RowVersion);
        var resp = await Client.PatchAsJsonAsync(
            $"admin/admission-setup/declaration/{draft.Id}", updateReq);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ElectronicDeclarationDto>();
        dto!.BodyAr.Should().Be("نص محدث");
    }
}
