using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T021 — TotalScoreConfig domain invariants.
///
/// Coverage:
///   • Components sum to 100.
///   • Each component weight is in [0, 100].
///   • At least one component required.
///   • totalScoreOutOf > 0.
/// </summary>
public sealed class TotalScoreConfigTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var cfg = TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components:
            [
                new TotalScoreComponent("written", 40, 50),
                new TotalScoreComponent("interview", 30),
                new TotalScoreComponent("physical", 30),
            ],
            totalScoreOutOf: 1000,
            Actor);

        cfg.CycleId.Should().Be(CycleId);
        cfg.ApplicantStream.Should().Be(ApplicantStream.General);
        cfg.TotalScoreOutOf.Should().Be(1000);
    }

    [Fact]
    public void Create_WeightsSumNot100_Throws()
    {
        var act = () => TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components:
            [
                new TotalScoreComponent("a", 50),
                new TotalScoreComponent("b", 30), // sum = 80
            ],
            totalScoreOutOf: 100, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*100*المجموع الحالي 80*");
    }

    [Fact]
    public void Create_EmptyComponents_Throws()
    {
        var act = () => TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components: [],
            totalScoreOutOf: 100, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*مكون واحد*");
    }

    [Fact]
    public void Create_WeightAbove100_Throws()
    {
        var act = () => TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components: [new TotalScoreComponent("solo", 100)], // valid sum
            totalScoreOutOf: 100, Actor);

        // 100 alone is fine (sum=100), so test a different case:
        act.Should().NotThrow();

        var act2 = () => TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components:
            [
                new TotalScoreComponent("a", 150),
                new TotalScoreComponent("b", -50), // sum = 100 but b is negative
            ],
            totalScoreOutOf: 100, Actor);

        act2.Should().Throw<ArgumentException>().WithMessage("*0–100*");
    }

    [Fact]
    public void Create_TotalScoreOutOfZero_Throws()
    {
        var act = () => TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            components: [new TotalScoreComponent("solo", 100)],
            totalScoreOutOf: 0, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*أكبر من صفر*");
    }

    [Fact]
    public void Create_DifferentStreams_AreIndependent()
    {
        var general = TotalScoreConfig.Create(
            CycleId, ApplicantStream.General,
            [new TotalScoreComponent("written", 100)],
            100, Actor);

        var sportsFemale = TotalScoreConfig.Create(
            CycleId, ApplicantStream.SportsFemale,
            [new TotalScoreComponent("physical", 100)],
            100, Actor);

        general.ApplicantStream.Should().Be(ApplicantStream.General);
        sportsFemale.ApplicantStream.Should().Be(ApplicantStream.SportsFemale);
    }
}
