using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using PACademy.Modules.Admissions.Infrastructure.Persistence;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.AdmissionSetup;

/// <summary>
/// Spec 009 T054 — Performance test for ApplyMergeSplitRule.
/// Seeds a fixture cycle with 5 000 applicants spread across 5 committees.
/// Asserts that the Apply HTTP call completes within 10 seconds on the dev DB
/// (SC-010 from spec.md).
/// </summary>
[Collection("AdmissionSetup")]
public sealed class ApplyMergeSplitRulePerfTests(AdmissionSetupFixture fixture)
    : AdmissionSetupTestBase(fixture)
{
    private const int ApplicantCount = 5_000;
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(10);

    private static readonly Guid PerfSrc1 = Guid.Parse("F0000000-0000-0000-0000-000000000001");
    private static readonly Guid PerfSrc2 = Guid.Parse("F0000000-0000-0000-0000-000000000002");
    private static readonly Guid PerfTarget = Guid.Parse("F0000000-0000-0000-0000-000000000003");
    private static readonly DateTime Effective = new(2030, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Apply_5000Applicants_CompletesWithin10Seconds()
    {
        var cycleId = await SeedDraftCycleAsync();
        await SeedApplicantsAsync(cycleId);

        // Create the merge rule via HTTP
        var createResp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/cycles/{cycleId}/merge-split-rules",
            new CreateMergeSplitRuleRequest(
                Type: "Merge",
                SourceCommitteeIds: [PerfSrc1, PerfSrc2],
                TargetCommitteeIds: [PerfTarget],
                EffectiveAt: Effective,
                Reason: "اختبار الأداء"));

        createResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var rule = await createResp.Content.ReadFromJsonAsync<MergeSplitRuleDto>();

        // Preview to obtain a valid hash
        var previewResp = await Client.PostAsync(
            $"admin/admission-setup/merge-split-rules/{rule!.Id}/preview", null);
        previewResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var preview = await previewResp.Content.ReadFromJsonAsync<MergeSplitPreviewDto>();

        // Time the Apply call
        var sw = Stopwatch.StartNew();
        var applyResp = await Client.PostAsJsonAsync(
            $"admin/admission-setup/merge-split-rules/{rule.Id}/apply",
            new ApplyMergeSplitRuleRequest(
                ConfirmPreviewHash: preview!.PreviewHash,
                RowVersion: rule.RowVersion));
        sw.Stop();

        applyResp.StatusCode.Should().Be(HttpStatusCode.OK,
            $"Apply must succeed (took {sw.ElapsedMilliseconds} ms)");

        sw.Elapsed.Should().BeLessThan(Budget,
            $"Apply on {ApplicantCount} applicants must complete within 10 s (SC-010); " +
            $"actual: {sw.ElapsedMilliseconds} ms");

        // Verify the applicant-move count in the response
        var result = await applyResp.Content.ReadFromJsonAsync<ApplyResultDto>();
        result!.ApplicantsMoved.Should().Be(ApplicantCount,
            "all seeded applicants in the source committees must be moved");
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async Task SeedApplicantsAsync(Guid cycleId)
    {
        // Use a raw DbContext scope for bulk-insert speed.
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdmissionsDbContext>();

        var committees = new[] { PerfSrc1, PerfSrc2 };
        var applicants = new List<Applicant>(ApplicantCount);

        for (int i = 0; i < ApplicantCount; i++)
        {
            var a = Applicant.Create(
                nationalId: (10_000_000_000_000L + i).ToString(),
                fullName: $"متقدم {i + 1}",
                cycleId: cycleId,
                createdBy: TestActorId);

            // Assign to source committees round-robin
            a.AssignCommittee(committees[i % committees.Length]);
            applicants.Add(a);
        }

        // Insert in batches of 500 to avoid parameter-limit issues
        const int batchSize = 500;
        for (int offset = 0; offset < applicants.Count; offset += batchSize)
        {
            db.Applicants.AddRange(applicants.Skip(offset).Take(batchSize));
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
        }
    }
}
