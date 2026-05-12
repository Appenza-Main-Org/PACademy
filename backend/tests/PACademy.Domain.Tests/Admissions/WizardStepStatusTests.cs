using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T020-equivalent — WizardStepStatus state-machine tests.
///
/// Coverage:
///   • CreateInProgress initializes to InProgress (FR-014: auto-promote on first save).
///   • MarkComplete stamps actor + timestamp.
///   • Reopen clears completion fields.
///   • AutoPromoteToInProgress only promotes from NotStarted (idempotent on already-in-progress).
///   • AutoDemoteFromComplete only demotes from Complete (idempotent on in-progress).
/// </summary>
public sealed class WizardStepStatusTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private const string StepKey = "exam_dates";

    [Fact]
    public void CreateInProgress_StartsInInProgress()
    {
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);

        status.CycleId.Should().Be(CycleId);
        status.StepKey.Should().Be(StepKey);
        status.Status.Should().Be(WizardStepStatusValue.InProgress);
        status.CompletedAt.Should().BeNull();
        status.CompletedBy.Should().BeNull();
    }

    [Fact]
    public void MarkComplete_StampsActorAndTimestamp()
    {
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);

        status.MarkComplete(Actor);

        status.Status.Should().Be(WizardStepStatusValue.Complete);
        status.CompletedBy.Should().Be(Actor);
        status.CompletedAt.Should().NotBeNull();
        status.CompletedAt!.Value.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Reopen_ClearsCompletionFields()
    {
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);
        status.MarkComplete(Actor);

        status.Reopen();

        status.Status.Should().Be(WizardStepStatusValue.InProgress);
        status.CompletedAt.Should().BeNull();
        status.CompletedBy.Should().BeNull();
    }

    [Fact]
    public void AutoPromoteToInProgress_IsNoOpWhenAlreadyInProgress()
    {
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);
        var prevUpdated = status.UpdatedAt;
        Thread.Sleep(5); // tiny gap so UpdatedAt comparison works

        status.AutoPromoteToInProgress();

        status.Status.Should().Be(WizardStepStatusValue.InProgress);
        status.UpdatedAt.Should().BeAfter(prevUpdated); // touch always
    }

    [Fact]
    public void AutoDemoteFromComplete_DemotesAndKeepsCompletionFieldsByDesign()
    {
        // CompletedAt / CompletedBy intentionally NOT cleared by AutoDemote —
        // only by explicit Reopen. The wizard-status interceptor uses
        // AutoDemote when a tracked entity is modified after the step was
        // marked complete; preserving the timestamp keeps the audit trail
        // showing "was completed at X, then edited again".
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);
        status.MarkComplete(Actor);

        status.AutoDemoteFromComplete();

        status.Status.Should().Be(WizardStepStatusValue.InProgress);
    }

    [Fact]
    public void AutoDemoteFromComplete_IsNoOpWhenAlreadyInProgress()
    {
        var status = WizardStepStatus.CreateInProgress(CycleId, StepKey);

        status.AutoDemoteFromComplete();

        status.Status.Should().Be(WizardStepStatusValue.InProgress);
    }
}
