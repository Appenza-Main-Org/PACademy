using FluentAssertions;
using PACademy.Api.Tests.Admin.AdmissionSetup;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Committees.Application.Dtos;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Committees;

/// <summary>
/// Spec 009 T066 — AdminCommitteeDateBindingsController HTTP integration tests (contracts §10).
/// GET list, PUT upsert, DELETE.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class DateBindingsIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private const string BoundDate = "2030-07-15";

    [Fact]
    public async Task List_BeforeBinding_ReturnsEmpty()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);

        var resp = await Client.GetAsync(
            $"admin/committees/{committee.Id}/date-bindings");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeDateBindingDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Put_ValidBinding_Returns200()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);

        var resp = await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(Capacity: 30, RowVersion: null));

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDateBindingDto>();
        dto.Should().NotBeNull();
        dto!.CommitteeId.Should().Be(committee.Id);
        dto.BoundDate.Should().Be(BoundDate);
        dto.Capacity.Should().Be(30);
    }

    [Fact]
    public async Task Put_SubsequentUpsert_UpdatesCapacity()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);
        await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(10, null));

        var resp = await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(60, null));

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<CommitteeDateBindingDto>();
        dto!.Capacity.Should().Be(60);
    }

    [Fact]
    public async Task List_AfterBinding_ReturnsOne()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);
        await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(25, null));

        var resp = await Client.GetAsync(
            $"admin/committees/{committee.Id}/date-bindings");

        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeDateBindingDto>>();
        items!.Should().HaveCount(1);
        items[0].Capacity.Should().Be(25);
    }

    [Fact]
    public async Task Delete_ExistingBinding_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);
        await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(20, null));

        var resp = await Client.DeleteAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}");

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_AfterDelete_ListIsEmpty()
    {
        var cycleId = await SeedDraftCycleAsync();
        var committee = await CreateCommitteeAsync(cycleId);
        await Client.PutAsJsonAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}",
            new UpsertDateBindingRequest(20, null));
        await Client.DeleteAsync(
            $"admin/committees/{committee.Id}/date-bindings/{BoundDate}");

        var resp = await Client.GetAsync(
            $"admin/committees/{committee.Id}/date-bindings");

        var items = await resp.Content.ReadFromJsonAsync<List<CommitteeDateBindingDto>>();
        items.Should().BeEmpty();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<CommitteeDto> CreateCommitteeAsync(Guid cycleId)
    {
        var resp = await Client.PostAsJsonAsync("admin/committees",
            new CreateCommitteeRequest(cycleId, $"key-{Guid.NewGuid():N[..8]}", "لجنة", null, null, 50, []));
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CommitteeDto>())!;
    }
}
