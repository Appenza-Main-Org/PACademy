namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Device-facing contracts for the biometric gateway. They carry capture
/// payloads (template refs / capture tokens) rather than booleans, so the real
/// device implementation drops in behind <see cref="IBiometricDeviceGateway"/>
/// with zero changes to <c>BiometricService</c>.
/// </summary>
public sealed record BiometricCaptureRequest(
    string ApplicantId,
    string Modality,        // "face" | "fingerprint"
    string? CaptureToken,   // opaque live-capture handle from the device SDK
    string? EmpCode = null, // device employee code (national id); falls back to ApplicantId
    string? DisplayName = null, // device first_name; falls back to EmpCode
    string? TerminalSn = null); // create the employee in this terminal's area (ZKBioTime)

public sealed record BiometricCaptureResult(
    string TemplateRef,     // stored template reference the device returns on enroll
    int Quality,            // capture quality 0..100
    bool LivenessConfirmed,
    string? DeviceEmpId = null); // device-assigned employee id (the linkage key, not the national id)

public sealed record BiometricMatchRequest(
    string ApplicantId,
    string Modality,        // "face" | "fingerprint" | "barcode"
    string? TemplateRef,    // the enrolled template to verify against (1:1)
    string? CaptureToken,   // the live capture presented at the station
    string? EmpCode = null, // device employee code (national id); falls back to ApplicantId
    string? TerminalSn = null); // restrict the match to punches from this device

public sealed record BiometricMatchResult(
    bool IsMatch,
    int Confidence,         // confidence 0..100
    int Score);             // raw device match score 0..100

/// <summary>Raised on any device-side failure; mapped to a clean API error.</summary>
public sealed class BiometricDeviceException(string message) : Exception(message);

/// <summary>
/// Raised when an enroll would re-create an applicant who already has an
/// employee record on the device; mapped to a 409 CONFLICT envelope
/// (conflict code <c>BIOMETRIC_ALREADY_ENROLLED</c>).
/// </summary>
public sealed class BiometricAlreadyEnrolledException(string message) : Exception(message);
