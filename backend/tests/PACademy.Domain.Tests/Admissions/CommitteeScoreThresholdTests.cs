using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T019 — CommitteeScoreThreshold domain invariants.
///
/// Coverage:
///   • min must be ≤ max.
///   • Negative min or max is rejected.
///   • Happy-path Create and Update succeed and record actor.
/// </summary>
public sealed class CommitteeScoreThresholdTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid CommitteeId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var threshold = CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 50, max: 100, Actor);

        threshold.CycleId.Should().Be(CycleId);
        threshold.CommitteeId.Should().Be(CommitteeId);
        threshold.Min.Should().Be(50);
        threshold.Max.Should().Be(100);
        threshold.UpdatedBy.Should().Be(Actor);
    }

    [Fact]
    public void Create_EqualMinMax_Succeeds()
    {
        var threshold = CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 75, max: 75, Actor);

        threshold.Min.Should().Be(75);
        threshold.Max.Should().Be(75);
    }

    [Fact]
    public void Create_MinGreaterThanMax_Throws()
    {
        var act = () => CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 80, max: 50, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*الحد الأدنى*");
    }

    [Fact]
    public void Create_NegativeMin_Throws()
    {
        var act = () => CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: -1, max: 100, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*سالبة*");
    }

    [Fact]
    public void Create_NegativeMax_Throws()
    {
        // min:-5, max:-3 → min≤max so the negatives guard fires (not the min>max guard)
        var act = () => CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: -5, max: -3, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*سالبة*");
    }

    [Fact]
    public void Update_ValidValues_AppliesChange()
    {
        var threshold = CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 50, max: 100, Actor);
        var newActor = Guid.NewGuid();

        threshold.Update(min: 60, max: 90, newActor);

        threshold.Min.Should().Be(60);
        threshold.Max.Should().Be(90);
        threshold.UpdatedBy.Should().Be(newActor);
    }

    [Fact]
    public void Update_MinGreaterThanMax_Throws()
    {
        var threshold = CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 50, max: 100, Actor);

        var act = () => threshold.Update(min: 100, max: 50, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*الحد الأدنى*");
    }

    [Fact]
    public void Update_NegativeValues_Throws()
    {
        var threshold = CommitteeScoreThreshold.Create(CycleId, CommitteeId, min: 50, max: 100, Actor);

        var act = () => threshold.Update(min: -10, max: 100, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*سالبة*");
    }
}
