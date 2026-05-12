using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T020 — ExamDateConfig domain invariants.
///
/// Coverage:
///   • bookableDays must be non-empty.
///   • Every bookableDay date ≥ firstAvailableDate.
///   • blackoutDates ⊆ bookableDays (subset relationship).
/// </summary>
public sealed class ExamDateConfigTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTime FirstAvailable = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var cfg = ExamDateConfig.Create(
            CycleId, FirstAvailable,
            bookableDays: ["2026-07-01", "2026-07-02", "2026-07-15"],
            blackoutDates: ["2026-07-02"],
            Actor);

        cfg.CycleId.Should().Be(CycleId);
        cfg.FirstAvailableDate.Should().Be(FirstAvailable);
        cfg.UpdatedBy.Should().Be(Actor);
    }

    [Fact]
    public void Create_EmptyBookableDays_Throws()
    {
        var act = () => ExamDateConfig.Create(
            CycleId, FirstAvailable, bookableDays: [], blackoutDates: [], Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*يوم حجز واحد*");
    }

    [Fact]
    public void Create_BookableDayBeforeFirstAvailable_Throws()
    {
        var act = () => ExamDateConfig.Create(
            CycleId, FirstAvailable,
            bookableDays: ["2026-06-30"], // 1 day before FirstAvailable
            blackoutDates: [],
            Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*يسبق*");
    }

    [Fact]
    public void Create_BlackoutNotInBookable_Throws()
    {
        var act = () => ExamDateConfig.Create(
            CycleId, FirstAvailable,
            bookableDays: ["2026-07-01"],
            blackoutDates: ["2026-08-01"], // not in bookableDays
            Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*ليس ضمن*");
    }

    [Fact]
    public void Update_AppliesSameValidation()
    {
        var cfg = ExamDateConfig.Create(
            CycleId, FirstAvailable, ["2026-07-01"], [], Actor);

        var act = () => cfg.Update(
            FirstAvailable, bookableDays: [], blackoutDates: [], Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*يوم حجز واحد*");
    }

    [Fact]
    public void Update_NewActorRecorded()
    {
        var cfg = ExamDateConfig.Create(
            CycleId, FirstAvailable, ["2026-07-01"], [], Actor);
        var newActor = Guid.NewGuid();

        cfg.Update(FirstAvailable, ["2026-07-01", "2026-07-02"], [], newActor);

        cfg.UpdatedBy.Should().Be(newActor);
    }
}
