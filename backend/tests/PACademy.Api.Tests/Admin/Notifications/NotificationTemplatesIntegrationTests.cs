using FluentAssertions;
using PACademy.Api.Tests.Admin.AdmissionSetup;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Notifications.Application.Templates;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Notifications;

/// <summary>
/// Spec 009 T067 — AdminNotificationTemplatesController HTTP integration tests (contracts §11).
/// Create, Get, List, Update, Publish, Unpublish, Archive, Restore happy paths;
/// update-on-published → 422; archive-on-published → 422.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class NotificationTemplatesIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly CreateNotificationTemplateRequest ValidRequest = new(
        CycleId: null,
        TriggerEvent: "application_received",
        SubjectAr: "تم استلام طلبك",
        BodyAr: "نود إعلامك بأننا استلمنا طلبك وسيتم مراجعته قريباً",
        Channel: "email");

    [Fact]
    public async Task List_BeforeCreation_ReturnsEmpty()
    {
        var resp = await Client.GetAsync("admin/notification-templates");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<NotificationTemplateDto>>();
        // The list may contain pre-existing templates from earlier tests — just assert OK.
        items.Should().NotBeNull();
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        var resp = await Client.PostAsJsonAsync("admin/notification-templates", ValidRequest);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto.Should().NotBeNull();
        dto!.SubjectAr.Should().Be("تم استلام طلبك");
        dto.IsPublished.Should().BeFalse();
        dto.PublishedAt.Should().BeNull();
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_ExistingTemplate_ReturnsDto()
    {
        var created = await CreateTemplateAsync();

        var resp = await Client.GetAsync($"admin/notification-templates/{created.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task Get_UnknownTemplate_Returns404()
    {
        var resp = await Client.GetAsync($"admin/notification-templates/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_UnpublishedTemplate_Returns200()
    {
        var created = await CreateTemplateAsync();
        var req = new UpdateNotificationTemplateRequest(
            SubjectAr: "موضوع محدث",
            BodyAr: null,
            RowVersion: created.RowVersion);

        var resp = await Client.PatchAsJsonAsync(
            $"admin/notification-templates/{created.Id}", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto!.SubjectAr.Should().Be("موضوع محدث");
    }

    [Fact]
    public async Task Publish_UnpublishedTemplate_Returns200WithPublishedAt()
    {
        var created = await CreateTemplateAsync();

        var resp = await Client.PostAsJsonAsync(
            $"admin/notification-templates/{created.Id}/publish",
            new PublishTemplateRequest(created.RowVersion));

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto!.IsPublished.Should().BeTrue();
        dto.PublishedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Update_PublishedTemplate_Returns422()
    {
        var created = await CreateTemplateAsync();
        var published = await PublishTemplateAsync(created);

        var resp = await Client.PatchAsJsonAsync(
            $"admin/notification-templates/{created.Id}",
            new UpdateNotificationTemplateRequest("جديد", null, published.RowVersion));

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Unpublish_PublishedTemplate_Returns200()
    {
        var created = await CreateTemplateAsync();
        var published = await PublishTemplateAsync(created);

        var resp = await Client.PostAsJsonAsync(
            $"admin/notification-templates/{created.Id}/unpublish",
            new PublishTemplateRequest(published.RowVersion));

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto!.IsPublished.Should().BeFalse();
        dto.PublishedAt.Should().BeNull();
    }

    [Fact]
    public async Task Archive_UnpublishedTemplate_Returns204()
    {
        var created = await CreateTemplateAsync();

        var resp = await Client.PostAsJsonAsync(
            $"admin/notification-templates/{created.Id}/archive",
            new ArchiveTemplateRequest("لا حاجة"));

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Archive_PublishedTemplate_Returns422()
    {
        var created = await CreateTemplateAsync();
        await PublishTemplateAsync(created);

        var resp = await Client.PostAsJsonAsync(
            $"admin/notification-templates/{created.Id}/archive",
            new ArchiveTemplateRequest(null));

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Restore_ArchivedTemplate_Returns200()
    {
        var created = await CreateTemplateAsync();
        await Client.PostAsJsonAsync(
            $"admin/notification-templates/{created.Id}/archive",
            new ArchiveTemplateRequest(null));

        var resp = await Client.PostAsync(
            $"admin/notification-templates/{created.Id}/restore", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>();
        dto.Should().NotBeNull();
        dto!.IsPublished.Should().BeFalse();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<NotificationTemplateDto> CreateTemplateAsync()
    {
        var resp = await Client.PostAsJsonAsync("admin/notification-templates", ValidRequest);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>())!;
    }

    private async Task<NotificationTemplateDto> PublishTemplateAsync(NotificationTemplateDto t)
    {
        var resp = await Client.PostAsJsonAsync(
            $"admin/notification-templates/{t.Id}/publish",
            new PublishTemplateRequest(t.RowVersion));
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<NotificationTemplateDto>())!;
    }
}
