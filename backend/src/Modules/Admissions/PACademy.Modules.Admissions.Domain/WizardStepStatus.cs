namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Per-(cycle, step) status row for the 15-step admission-setup wizard.
/// Composite PK: (CycleId, StepKey).
/// FR-014: not_started→in_progress is auto-promoted by WizardStatusInterceptor;
/// in_progress→complete is admin-driven via explicit endpoint.
/// </summary>
public sealed class WizardStepStatus
{
    public Guid CycleId { get; private set; }
    public string StepKey { get; private set; } = string.Empty;
    public WizardStepStatusValue Status { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public Guid? CompletedBy { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private WizardStepStatus() { }

    public static WizardStepStatus CreateInProgress(Guid cycleId, string stepKey)
        => new()
        {
            CycleId = cycleId,
            StepKey = stepKey,
            Status = WizardStepStatusValue.InProgress,
            UpdatedAt = DateTime.UtcNow,
        };

    public void MarkComplete(Guid actorId)
    {
        Status = WizardStepStatusValue.Complete;
        CompletedAt = DateTime.UtcNow;
        CompletedBy = actorId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reopen()
    {
        Status = WizardStepStatusValue.InProgress;
        CompletedAt = null;
        CompletedBy = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Called by WizardStatusInterceptor when a save targets this step's table.</summary>
    public void AutoPromoteToInProgress()
    {
        if (Status == WizardStepStatusValue.NotStarted)
            Status = WizardStepStatusValue.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Called by WizardStatusInterceptor when a save targets a complete step's table.
    /// Demotes back to in_progress so admin must re-confirm completion.
    /// </summary>
    public void AutoDemoteFromComplete()
    {
        if (Status == WizardStepStatusValue.Complete)
            Status = WizardStepStatusValue.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }
}
