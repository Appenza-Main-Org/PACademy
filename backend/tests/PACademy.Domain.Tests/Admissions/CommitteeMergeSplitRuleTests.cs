using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T018 — domain invariants for CommitteeMergeSplitRule.
///
/// Coverage:
///   • Merge requires ≥ 2 source committees and exactly 1 target.
///   • Split requires exactly 1 source committee and ≥ 2 targets.
///   • Apply flips status to applied and stamps applied_at / applied_by.
///   • Cancel only allowed on planned rules.
///   • Applied rules reject any further mutation (UpdateShape / Cancel / Archive).
///   • Archive blocked on applied rules.
/// </summary>
public sealed class CommitteeMergeSplitRuleTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTime EffectiveAt = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

    // ── Merge invariants ───────────────────────────────────────────────────────

    [Fact]
    public void Merge_RejectsFewerThanTwoSources()
    {
        var act = () => CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Merge,
            sourceCommitteeIds: [Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid()],
            EffectiveAt, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*دمج*مصدر*");
    }

    [Fact]
    public void Merge_RejectsMultipleTargets()
    {
        var act = () => CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Merge,
            sourceCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            EffectiveAt, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*دمج*هدف*واحدة*");
    }

    [Fact]
    public void Merge_AcceptsTwoSourcesOneTarget()
    {
        var src = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var tgt = new[] { Guid.NewGuid() };

        var rule = CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Merge, src, tgt, EffectiveAt, Actor);

        rule.Type.Should().Be(MergeSplitType.Merge);
        rule.Status.Should().Be(MergeSplitStatus.Planned);
        rule.CycleId.Should().Be(CycleId);
        rule.CreatedBy.Should().Be(Actor);
        rule.IsArchived.Should().BeFalse();
    }

    // ── Split invariants ───────────────────────────────────────────────────────

    [Fact]
    public void Split_RejectsMultipleSources()
    {
        var act = () => CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Split,
            sourceCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            EffectiveAt, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*فصل*مصدر*واحدة*");
    }

    [Fact]
    public void Split_RejectsFewerThanTwoTargets()
    {
        var act = () => CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Split,
            sourceCommitteeIds: [Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid()],
            EffectiveAt, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*فصل*هدف*");
    }

    [Fact]
    public void Split_AcceptsOneSourceTwoTargets()
    {
        var rule = CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Split,
            sourceCommitteeIds: [Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            EffectiveAt, Actor);

        rule.Type.Should().Be(MergeSplitType.Split);
        rule.Status.Should().Be(MergeSplitStatus.Planned);
    }

    // ── Apply transition ───────────────────────────────────────────────────────

    [Fact]
    public void Apply_FromPlanned_FlipsStatusAndStampsActor()
    {
        var rule = NewPlannedMerge();

        rule.Apply(Actor);

        rule.Status.Should().Be(MergeSplitStatus.Applied);
        rule.AppliedBy.Should().Be(Actor);
        rule.AppliedAt.Should().NotBeNull();
        rule.AppliedAt!.Value.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Apply_Twice_RejectsSecondCall()
    {
        var rule = NewPlannedMerge();
        rule.Apply(Actor);

        var act = () => rule.Apply(Actor);

        act.Should().Throw<InvalidOperationException>().WithMessage("*مخططة*");
    }

    [Fact]
    public void Apply_OnCancelledRule_Rejects()
    {
        var rule = NewPlannedMerge();
        rule.Cancel(Actor, "test cancel");

        var act = () => rule.Apply(Actor);

        act.Should().Throw<InvalidOperationException>().WithMessage("*مخططة*");
    }

    // ── Cancel transition ──────────────────────────────────────────────────────

    [Fact]
    public void Cancel_FromPlanned_FlipsStatusAndRecordsReason()
    {
        var rule = NewPlannedMerge();

        rule.Cancel(Actor, "إعادة هيكلة");

        rule.Status.Should().Be(MergeSplitStatus.Cancelled);
        rule.CancelledBy.Should().Be(Actor);
        rule.CancelReason.Should().Be("إعادة هيكلة");
        rule.CancelledAt.Should().NotBeNull();
    }

    [Fact]
    public void Cancel_OnAppliedRule_Rejects()
    {
        var rule = NewPlannedMerge();
        rule.Apply(Actor);

        var act = () => rule.Cancel(Actor, "too late");

        act.Should().Throw<InvalidOperationException>().WithMessage("*مخططة*");
    }

    // ── UpdateShape — only allowed on planned ──────────────────────────────────

    [Fact]
    public void UpdateShape_OnAppliedRule_Rejects()
    {
        var rule = NewPlannedMerge();
        rule.Apply(Actor);

        var act = () => rule.UpdateShape(
            sourceCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid()],
            effectiveAt: null, reason: null);

        act.Should().Throw<InvalidOperationException>().WithMessage("*مخططة*");
    }

    [Fact]
    public void UpdateShape_OnPlannedRule_ChangesFields()
    {
        var rule = NewPlannedMerge();
        var newSrc = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var newTgt = new[] { Guid.NewGuid() };
        var newDate = new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc);

        rule.UpdateShape(newSrc, newTgt, newDate, "updated reason");

        rule.EffectiveAt.Should().Be(newDate);
        rule.Reason.Should().Be("updated reason");
    }

    // ── Archive — blocked on applied rules ─────────────────────────────────────

    [Fact]
    public void Archive_OnAppliedRule_Rejects()
    {
        var rule = NewPlannedMerge();
        rule.Apply(Actor);

        var act = () => rule.Archive();

        act.Should().Throw<InvalidOperationException>().WithMessage("*مطبقة*");
    }

    [Fact]
    public void Archive_OnPlannedRule_Allowed()
    {
        var rule = NewPlannedMerge();

        rule.Archive();

        rule.IsArchived.Should().BeTrue();
    }

    [Fact]
    public void Archive_OnCancelledRule_Allowed()
    {
        var rule = NewPlannedMerge();
        rule.Cancel(Actor, "cancelled first");

        rule.Archive();

        rule.IsArchived.Should().BeTrue();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static CommitteeMergeSplitRule NewPlannedMerge()
        => CommitteeMergeSplitRule.Create(
            CycleId, MergeSplitType.Merge,
            sourceCommitteeIds: [Guid.NewGuid(), Guid.NewGuid()],
            targetCommitteeIds: [Guid.NewGuid()],
            EffectiveAt, Actor);
}
