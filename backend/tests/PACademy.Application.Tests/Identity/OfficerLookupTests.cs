using FluentAssertions;
using PACademy.Modules.Identity.Application.Officers;
using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Application.Tests.Identity;

/// <summary>
/// T453-T454 — LookupOfficerUseCase unit tests.
/// IOfficerLookup is stubbed directly; IAuditApi uses a minimal spy.
/// </summary>
public sealed class OfficerLookupTests
{
    private static readonly OfficerRecord SampleRecord = new(
        NationalId: "12345678901234",
        OfficerCode: "OFF001",
        FullName: "ضابط تجريبي",
        Mobile: "01012345678",
        Email: "officer@test.local",
        IssueDate: new DateTime(2020, 1, 1),
        CardFactoryNumber: "CARD001",
        Unit: "القاهرة");

    // ── T453: Found record returned as-is ────────────────────────────────────
    [Fact]
    public async Task Execute_OfficerFound_ReturnsRecord()
    {
        var lookup = new StubOfficerLookup(SampleRecord);
        var audit = new NullAuditApi();
        var sut = new LookupOfficerUseCase(lookup, audit);

        var (record, unavailable) = await sut.ExecuteAsync("12345678901234", "OFF001", Guid.NewGuid());

        unavailable.Should().BeFalse();
        record.Should().NotBeNull();
        record!.OfficerCode.Should().Be("OFF001");
        record.FullName.Should().Be("ضابط تجريبي");
    }

    [Fact]
    public async Task Execute_OfficerNotFound_ReturnsNull()
    {
        var lookup = new StubOfficerLookup(null);
        var audit = new NullAuditApi();
        var sut = new LookupOfficerUseCase(lookup, audit);

        var (record, unavailable) = await sut.ExecuteAsync("99999999999999", "NONE", Guid.NewGuid());

        unavailable.Should().BeFalse();
        record.Should().BeNull();
    }

    // ── T454: Upstream unavailable sets Unavailable flag ─────────────────────
    [Fact]
    public async Task Execute_UpstreamUnavailable_SetsUnavailableFlag()
    {
        var lookup = new FailingOfficerLookup();
        var audit = new NullAuditApi();
        var sut = new LookupOfficerUseCase(lookup, audit);

        var (record, unavailable) = await sut.ExecuteAsync("12345678901234", "OFF001", Guid.NewGuid());

        unavailable.Should().BeTrue();
        record.Should().BeNull();
    }

    // ── Test doubles ──────────────────────────────────────────────────────────

    private sealed class StubOfficerLookup(OfficerRecord? result) : IOfficerLookup
    {
        public Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct = default)
            => Task.FromResult(result);
    }

    private sealed class FailingOfficerLookup : IOfficerLookup
    {
        public Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct = default)
            => throw new OfficerLookupUnavailableException("circuit open");
    }

    private sealed class NullAuditApi : IAuditApi
    {
        public Task RecordAsync(
            AuditAction action, string targetType, Guid targetId, string targetLabel,
            AuditOutcome outcome, string? beforeJson = null, string? afterJson = null,
            CancellationToken ct = default)
            => Task.CompletedTask;
    }
}
