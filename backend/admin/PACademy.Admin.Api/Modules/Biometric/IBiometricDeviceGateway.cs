namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Seam over the physical biometric device (out of scope per BRD §8). The
/// simulated implementation is deterministic and hardware-free; the real
/// implementation calls the device's HTTP SDK. Selection is driven by the
/// <c>Biometric:Mode</c> config flag — exactly like the MOI auth gateway.
/// Consumers (<c>BiometricService</c>) depend only on this interface, so
/// flipping the flag swaps the device with no consumer changes.
/// </summary>
public interface IBiometricDeviceGateway
{
    /// <summary>Enroll a modality (face / fingerprint); returns a template ref + quality.</summary>
    Task<BiometricCaptureResult> CaptureAsync(BiometricCaptureRequest request, CancellationToken ct);

    /// <summary>1:1 verify a live capture against a stored template; returns match + confidence.</summary>
    Task<BiometricMatchResult> MatchAsync(BiometricMatchRequest request, CancellationToken ct);

    /// <summary>
    /// True when an employee record already exists on the device for this
    /// emp_code — drives the duplicate-enroll guard. Gateways without a
    /// personnel directory (simulated / real SDK stub) return false.
    /// </summary>
    Task<bool> EmployeeExistsAsync(string empCode, CancellationToken ct);
}
