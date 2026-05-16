using FluentAssertions;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T023 — CommitteeMergeSplitRule HTTP integration tests.
/// List/Get/Create/Update/Cancel/Archive happy paths;
/// Preview returns expected shape; Apply runs the transactional move and
/// the rule becomes immutable; stale previewHash → 422; applied rule rejects update.
/// </summary>
[Collection("AdmissionSetup")]
public sealed class MergeSplitRulesIntegrationTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private static readonly Guid Src1 = Guid.Parse("A0000000-0000-0000-0000-000000000001");
    private static readonly Guid Src2 = Guid.Parse("A0000000-0000-0000-0000-000000000002");
    private static readonly Guid Target = Guid.Parse("A0000000-0000-0000-0000-000000000003");
    private static readonly Guid SplitTarget2 = Guid.Parse("A0000000-0000-0000-0000-000000000004");
    private static readonly DateTime Effective = new(2030, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private async Task<MergeSplitRuleDto> CreateMergeRuleAsync(Guid cycleId)
    {
        var req = new CreateMergeSplitRuleRequest(
            Type: "Merge",
            SourceCommitteeIds: [Src1, Src2],
            TargetCommitteeIds: [Target],
            EffectiveAt: Effective,
            Reason: "اختبار الدمج");

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules", req);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>())!;
    }

    [Fact]
    public async Task List_BeforeCreation_ReturnsEmptyList()
    {
        var cycleId = await SeedDraftCycleAsync();

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await resp.Content.ReadFromJsonAsync<List<MergeSplitRuleDto>>();
        items.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task Post_MergeRule_Returns201WithPlannedStatus()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateMergeSplitRuleRequest(
            Type: "Merge",
            SourceCommitteeIds: [Src1, Src2],
            TargetCommitteeIds: [Target],
            EffectiveAt: Effective);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto.Should().NotBeNull();
        dto!.CycleId.Should().Be(cycleId);
        dto.Type.Should().Be("merge");
        dto.Status.Should().Be("planned");
        dto.SourceCommitteeIds.Should().HaveCount(2);
        dto.TargetCommitteeIds.Should().HaveCount(1);
        dto.RowVersion.Should().NotBeNullOrEmpty();
        resp.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task Post_SplitRule_Returns201()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateMergeSplitRuleRequest(
            Type: "Split",
            SourceCommitteeIds: [Src1],
            TargetCommitteeIds: [Target, SplitTarget2],
            EffectiveAt: Effective);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules", req);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto!.Type.Should().Be("split");
    }

    [Fact]
    public async Task Post_MergeWithOneSource_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateMergeSplitRuleRequest(
            Type: "Merge",
            SourceCommitteeIds: [Src1], // merge requires ≥2 sources
            TargetCommitteeIds: [Target],
            EffectiveAt: Effective);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Post_InvalidType_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var req = new CreateMergeSplitRuleRequest(
            Type: "Unknown",
            SourceCommitteeIds: [Src1, Src2],
            TargetCommitteeIds: [Target],
            EffectiveAt: Effective);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules", req);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Get_ById_ReturnsRule()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task Get_UnknownId_Returns404()
    {
        var resp = await Client.GetAsync(
            $"admin/admission-setup/merge-split-rules/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_AfterCreation_ContainsRule()
    {
        var cycleId = await SeedDraftCycleAsync();
        await CreateMergeRuleAsync(cycleId);

        var resp = await Client.GetAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules");

        var items = await resp.Content.ReadFromJsonAsync<List<MergeSplitRuleDto>>();
        items!.Should().HaveCount(1);
        items[0].Type.Should().Be("merge");
    }

    [Fact]
    public async Task Patch_PlannedRule_UpdatesShape()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        var updateReq = new UpdateMergeSplitRuleRequest(
            SourceCommitteeIds: [Src1, Src2],
            TargetCommitteeIds: [Target],
            EffectiveAt: new DateTime(2030, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            Reason: "سبب محدث",
            RowVersion: created.RowVersion);

        var resp = await Client.PatchAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}", updateReq);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto!.Reason.Should().Be("سبب محدث");
    }

    [Fact]
    public async Task Cancel_PlannedRule_FlipsStatusToCancelled()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        var req = new CancelMergeSplitRuleRequest(
            Reason: "تم الإلغاء للاختبار",
            RowVersion: created.RowVersion);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/cancel", req);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto!.Status.Should().Be("cancelled");
        dto.CancelReason.Should().Be("تم الإلغاء للاختبار");
    }

    [Fact]
    public async Task Preview_PlannedRule_ReturnsPreviewWithHash()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        var resp = await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/preview", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var preview = await resp.Content.ReadFromJsonAsync<MergeSplitPreviewDto>();
        preview.Should().NotBeNull();
        preview!.PreviewHash.Should().NotBeNullOrEmpty();
        preview.ApplicantsMoved.Should().NotBeNull();
        preview.CapacityChanges.Should().NotBeNull();
        preview.BrokenReferences.Should().NotBeNull();
    }

    [Fact]
    public async Task Apply_WithValidPreviewHash_AppliesRuleAndMakesItImmutable()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        // Get preview hash
        var preview = await (await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/preview", null))
            .Content.ReadFromJsonAsync<MergeSplitPreviewDto>();

        var applyReq = new ApplyMergeSplitRuleRequest(
            ConfirmPreviewHash: preview!.PreviewHash,
            RowVersion: created.RowVersion);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/apply", applyReq);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await resp.Content.ReadFromJsonAsync<ApplyResultDto>();
        result!.Applied.Should().BeTrue();

        // Rule should now be applied (immutable)
        var getResp = await Client.GetAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}");
        var dto = await getResp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();
        dto!.Status.Should().Be("applied");
    }

    [Fact]
    public async Task Apply_StalePrevieiHash_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        var applyReq = new ApplyMergeSplitRuleRequest(
            ConfirmPreviewHash: "stale_hash_that_doesnt_match",
            RowVersion: created.RowVersion);

        var resp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/apply", applyReq);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Update_AppliedRule_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        // Apply the rule first
        var preview = await (await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/preview", null))
            .Content.ReadFromJsonAsync<MergeSplitPreviewDto>();
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/apply",
            new ApplyMergeSplitRuleRequest(preview!.PreviewHash, created.RowVersion));

        // Try to update the applied rule
        var updateReq = new UpdateMergeSplitRuleRequest(
            SourceCommitteeIds: [Src1, Src2],
            TargetCommitteeIds: [Target],
            EffectiveAt: null,
            Reason: "محاولة تعديل مطبق",
            RowVersion: created.RowVersion);

        var resp = await Client.PatchAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}", updateReq);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Archive_CancelledRule_Returns204()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        // Cancel first
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/cancel",
            new CancelMergeSplitRuleRequest(null, created.RowVersion));

        // Then archive
        var resp = await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/archive", null);

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Archive_AppliedRule_Returns422()
    {
        var cycleId = await SeedDraftCycleAsync();
        var created = await CreateMergeRuleAsync(cycleId);

        // Apply first
        var preview = await (await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/preview", null))
            .Content.ReadFromJsonAsync<MergeSplitPreviewDto>();
        await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/apply",
            new ApplyMergeSplitRuleRequest(preview!.PreviewHash, created.RowVersion));

        // Try to archive applied rule
        var resp = await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{created.Id}/archive", null);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
