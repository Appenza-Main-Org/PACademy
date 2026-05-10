using FluentAssertions;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Domain.Tests.Identity;

/// <summary>
/// T443-T445 — LockPolicy domain entity tests.
/// Covers Default() values, Update() happy paths, and range guard-rails.
/// </summary>
public sealed class LockPolicyTests
{
    // ── T443: Default values ──────────────────────────────────────────────────
    [Fact]
    public void Default_HasExpectedValues()
    {
        var policy = LockPolicy.Default();

        policy.Id.Should().Be(1);
        policy.MaxFailedAttempts.Should().Be(5);
        policy.LockDurationMinutes.Should().Be(30);
        policy.DemoOrigin.Should().BeTrue();
        policy.UpdatedBy.Should().BeNull();
    }

    // ── T444: Update happy path ───────────────────────────────────────────────
    [Fact]
    public void Update_ValidValues_ChangesPolicy()
    {
        var policy = LockPolicy.Default();
        var actor = Guid.NewGuid();

        policy.Update(maxFailedAttempts: 3, lockDurationMinutes: 60, updatedBy: actor);

        policy.MaxFailedAttempts.Should().Be(3);
        policy.LockDurationMinutes.Should().Be(60);
        policy.UpdatedBy.Should().Be(actor);
        policy.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, precision: TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Update_OnlyMaxFailedAttempts_LeavesLockDurationUnchanged()
    {
        var policy = LockPolicy.Default();
        var original = policy.LockDurationMinutes;

        policy.Update(maxFailedAttempts: 8, lockDurationMinutes: null, updatedBy: Guid.NewGuid());

        policy.MaxFailedAttempts.Should().Be(8);
        policy.LockDurationMinutes.Should().Be(original);
    }

    [Fact]
    public void Update_OnlyLockDuration_LeavesMaxAttemptsUnchanged()
    {
        var policy = LockPolicy.Default();
        var original = policy.MaxFailedAttempts;

        policy.Update(maxFailedAttempts: null, lockDurationMinutes: 90, updatedBy: Guid.NewGuid());

        policy.MaxFailedAttempts.Should().Be(original);
        policy.LockDurationMinutes.Should().Be(90);
    }

    // ── T445: Boundary guard-rails ────────────────────────────────────────────
    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    [InlineData(-1)]
    [InlineData(100)]
    public void Update_MaxFailedAttemptsOutOfRange_Throws(int value)
    {
        var policy = LockPolicy.Default();

        var act = () => policy.Update(maxFailedAttempts: value, lockDurationMinutes: null, updatedBy: Guid.NewGuid());

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("maxFailedAttempts");
    }

    [Theory]
    [InlineData(4)]
    [InlineData(121)]
    [InlineData(0)]
    [InlineData(-10)]
    public void Update_LockDurationOutOfRange_Throws(int value)
    {
        var policy = LockPolicy.Default();

        var act = () => policy.Update(maxFailedAttempts: null, lockDurationMinutes: value, updatedBy: Guid.NewGuid());

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("lockDurationMinutes");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(10)]
    public void Update_MaxFailedAttemptsBoundaryValues_Accepted(int value)
    {
        var policy = LockPolicy.Default();
        policy.Update(maxFailedAttempts: value, lockDurationMinutes: null, updatedBy: Guid.NewGuid());
        policy.MaxFailedAttempts.Should().Be(value);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(30)]
    [InlineData(120)]
    public void Update_LockDurationBoundaryValues_Accepted(int value)
    {
        var policy = LockPolicy.Default();
        policy.Update(maxFailedAttempts: null, lockDurationMinutes: value, updatedBy: Guid.NewGuid());
        policy.LockDurationMinutes.Should().Be(value);
    }
}
