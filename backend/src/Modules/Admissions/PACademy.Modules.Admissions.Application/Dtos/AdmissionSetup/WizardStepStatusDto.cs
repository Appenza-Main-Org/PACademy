namespace PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

public sealed record WizardStepStatusDto(
    Guid CycleId,
    string StepKey,
    string Status,
    DateTime? CompletedAt,
    Guid? CompletedBy,
    string RowVersion);
