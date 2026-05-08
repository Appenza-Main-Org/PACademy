using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Api.Tests.Seeding;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Infrastructure.Persistence;
using System.Net;
using System.Net.Http.Json;

namespace PACademy.Api.Tests.Admin.Applicants;

/// <summary>
/// T039 — PATCH /admin/applicants/{id} → applicant fetch returns the new value;
/// audit_entry row appears with actor/target/diff. Editing a demo_origin=true
/// applicant preserves the flag (FR-017 permanence).
///
/// Per Resolved Clarification #15, PATCH does NOT accept status — only profile
/// fields. Status transitions are a later phase (POST /transition).
/// Per Resolved Clarification #16, PATCH on a locked (Deferred) applicant
/// rejects with 422 + APPLICANT_LOCKED.
/// </summary>
[Collection("SqlServer")]
public sealed class UpdateAndPropagateTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: true);
        await _factory.InitializeAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Patch_ChangesGovernorate_AndEmitsAuditEntry()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var applicant = await db.Applicants.AsNoTracking()
            .FirstAsync(a => a.DemoOrigin && !a.Archived);
        var originalGovernorate = applicant.Governorate;

        var client = _factory.CreateClient();

        var newGov = "محافظة الاختبار";
        var patch = new ApplicantPatchDto(
            FullName: null,
            Mobile: null,
            Email: null,
            Governorate: newGov);

        var resp = await client.PatchAsJsonAsync($"/admin/applicants/{applicant.Id}", patch);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await resp.Content.ReadFromJsonAsync<ApplicantDetailDto>();
        updated.Should().NotBeNull();
        updated!.Governorate.Should().Be(newGov);

        // Re-fetch persists
        var getResp = await client.GetAsync($"/admin/applicants/{applicant.Id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await getResp.Content.ReadFromJsonAsync<ApplicantDetailDto>();
        fetched!.Governorate.Should().Be(newGov);

        // Audit entry recorded
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<PaDbContext>();
        var auditEntries = await db2.AuditEntries
            .AsNoTracking()
            .Where(e => e.TargetId == applicant.Id && e.Action == AuditAction.Update)
            .ToListAsync();
        auditEntries.Should().NotBeEmpty();
        var latest = auditEntries.OrderByDescending(e => e.OccurredAt).First();
        latest.ActorId.Should().Be(TestAuthHandler.DefaultTestUserId);
        latest.Outcome.Should().Be(AuditOutcome.Success);
        if (originalGovernorate is not null)
            latest.BeforeJson.Should().Contain(originalGovernorate);
        latest.AfterJson.Should().Contain(newGov);
    }

    [Fact]
    public async Task Patch_DemoOriginApplicant_PreservesFlag()
    {
        // FR-017 permanence per Resolved Clarification #3
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var applicant = await db.Applicants.AsNoTracking()
            .FirstAsync(a => a.DemoOrigin && !a.Archived);
        applicant.DemoOrigin.Should().BeTrue();

        var client = _factory.CreateClient();
        var patch = new ApplicantPatchDto(
            FullName: null,
            Mobile: "01099887766",
            Email: null,
            Governorate: "القاهرة");
        var resp = await client.PatchAsJsonAsync($"/admin/applicants/{applicant.Id}", patch);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var fetched = await resp.Content.ReadFromJsonAsync<ApplicantDetailDto>();
        fetched!.DemoOrigin.Should().BeTrue("FR-017 mandates demo_origin permanence");
    }

    [Fact]
    public async Task Patch_LockedApplicant_Returns422WithApplicantLockedCode()
    {
        // Resolved Clarification #16: editing a Deferred applicant rejects.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var applicant = await db.Applicants
            .FirstAsync(a => a.DemoOrigin && !a.Archived);

        applicant.UpdateStatus(ApplicantStatus.Deferred, TestAuthHandler.DefaultTestUserId);
        await db.SaveChangesAsync();

        var client = _factory.CreateClient();
        var patch = new ApplicantPatchDto(
            FullName: "اسم محاولة تعديل",
            Mobile: null,
            Email: null,
            Governorate: null);

        var resp = await client.PatchAsJsonAsync($"/admin/applicants/{applicant.Id}", patch);
        ((int)resp.StatusCode).Should().Be(422);

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("APPLICANT_LOCKED");
    }

    [Fact]
    public async Task Patch_NonexistentApplicant_Returns404()
    {
        var client = _factory.CreateClient();
        var resp = await client.PatchAsJsonAsync(
            $"/admin/applicants/{Guid.NewGuid()}",
            new ApplicantPatchDto(null, null, null, null));
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Patch_InvalidMobile_Returns400()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var applicant = await db.Applicants.AsNoTracking()
            .FirstAsync(a => a.DemoOrigin && !a.Archived && a.Status != ApplicantStatus.Deferred);

        var client = _factory.CreateClient();
        var resp = await client.PatchAsJsonAsync(
            $"/admin/applicants/{applicant.Id}",
            new ApplicantPatchDto(null, "0000000000", null, null));
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
