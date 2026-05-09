namespace PACademy.Modules.Admissions.Application.Dtos;

/// <summary>
/// Per-field PATCH payload for profile fields. Null = unchanged. Concurrent
/// writes use silent last-write-wins (FR-014).
///
/// Status changes are NOT accepted here — see Resolved Clarification #15.
/// Status transitions go through POST /admin/applicants/{id}/transition
/// (later phase) with a required reason and workflow-stage validation.
///
/// NationalId, CycleId are immutable post-creation.
/// </summary>
public sealed record ApplicantPatchDto(
    string? FullName,
    string? Mobile,
    string? Email,
    string? Governorate);
