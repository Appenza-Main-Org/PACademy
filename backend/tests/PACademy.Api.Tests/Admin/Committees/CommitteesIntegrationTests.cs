using FluentAssertions;
using PACademy.Api.Tests.Admin.AdmissionSetup;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Committees.Application.Dtos;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Committees;

/// <summary>
/// Spec 009 T065 — AdminCommitteesController HTTP integration tests (contracts §9).
/// List, Get, Create, Update, AddMember, RemoveMember, Archive, Restore.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class CommitteesIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly Guid UserId1 = Guid.Parse("D0000000-0000-0000-0000-000000000001");

    [Fact]
    public async Task List_BeforeCreation_ReturnsEmpty()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync($"admin/committees?cycleId={cycleId}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateCommitteeRequest(
            CycleId: cycleId,
            Key: "east",
            NameAr: "لجنة الشرق",
            NameEn: null,
            ChairUserId: null,
            DailyCapacity: 50,
            Specializations: []);

        var resp = await Client.PostAsJsonAsync("admin/committees", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDto>();
        dto.Should().NotBeNull();
        dto!.Key.Should().Be("east");
        dto.NameAr.Should().Be("لجنة الشرق");
        dto.DailyCapacity.Should().Be(50);
        dto.Status.Should().Be("active");
        dto.RowVersion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_ExistingCommittee_ReturnsDto()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateCommitteeAsync(cycleId, "west");

        var resp = await Client.GetAsync($"admin/committees/{created.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDto>();
        dto!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task Get_UnknownCommittee_Returns404()
    {
        var resp = await Client.GetAsync($"admin/committees/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_AfterCreate_ReturnsOne()
    {
        var cycleId = await SeedDraftCycleAsync();
        await CreateCommitteeAsync(cycleId, "north");

        var resp = await Client.GetAsync($"admin/committees?cycleId={cycleId}");

        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeDto>>();
        items!.Should().HaveCount(1);
        items.Should().Contain(c => c.Key == "north");
    }

    [Fact]
    public async Task Update_NameAr_Returns200()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateCommitteeAsync(cycleId, "south");
        var req = new UpdateCommitteeRequest(
            NameAr: "لجنة الجنوب المحدثة",
            NameEn: null,
            ChairUserId: null,
            DailyCapacity: null,
            Status: null,
            RowVersion: created.RowVersion);

        var resp = await Client.PatchAsJsonAsync($"admin/committees/{created.Id}", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDto>();
        dto!.NameAr.Should().Be("لجنة الجنوب المحدثة");
    }

    [Fact]
    public async Task AddMember_ValidUserId_Returns201()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId, "central");
        var req = new AddCommitteeMemberRequest(UserId1, "member");

        var resp = await Client.PostAsJsonAsync(
            $"admin/committees/{committee.Id}/members", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var member = await resp.Content.ReadFromJsonAsync<CommitteeMemberDto>();
        member!.UserId.Should().Be(UserId1);
        member.Role.Should().Be("member");
    }

    [Fact]
    public async Task RemoveMember_ExistingMember_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId, "southern");
        await Client.PostAsJsonAsync(
            $"admin/committees/{committee.Id}/members",
            new AddCommitteeMemberRequest(UserId1, "member"));

        var resp = await Client.DeleteAsync(
            $"admin/committees/{committee.Id}/members/{UserId1}");

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Archive_ActiveCommittee_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId, "archive_me");

        var resp = await Client.PostAsJsonAsync(
            $"admin/committees/{committee.Id}/archive",
            new ArchiveCommitteeRequest("حل اللجنة"));

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Restore_ArchivedCommittee_Returns200()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId, "restore_me");
        await Client.PostAsJsonAsync(
            $"admin/committees/{committee.Id}/archive",
            new ArchiveCommitteeRequest(null));

        var resp = await Client.PostAsync(
            $"admin/committees/{committee.Id}/restore", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDto>();
        dto!.Status.Should().Be("active");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<CommitteeDto> CreateCommitteeAsync(Guid cycleId, string key)
    {
        var resp = await Client.PostAsJsonAsync("admin/committees",
            new CreateCommitteeRequest(cycleId, key, $"لجنة {key}", null, null, 40, []));
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CommitteeDto>())!;
    }
}
