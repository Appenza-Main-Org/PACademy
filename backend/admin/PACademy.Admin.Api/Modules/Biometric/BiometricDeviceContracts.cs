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
    string? CaptureToken);  // opaque live-capture handle from the device SDK

public sealed record BiometricCaptureResult(
    string TemplateRef,     // stored template reference the device returns on enroll
    int Quality,            // capture quality 0..100
    bool LivenessConfirmed);

public sealed record BiometricMatchRequest(
    string ApplicantId,
    string Modality,        // "face" | "fingerprint" | "barcode"
    string? TemplateRef,    // the enrolled template to verify against (1:1)
    string? CaptureToken);  // the live capture presented at the station

public sealed record BiometricMatchResult(
    bool IsMatch,
    int Confidence,         // confidence 0..100
    int Score);             // raw device match score 0..100

/// <summary>Raised on any device-side failure; mapped to a clean API error.</summary>
public sealed class BiometricDeviceException(string message) : Exception(message);
