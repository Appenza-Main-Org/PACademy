namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Deterministic, hardware-free device simulation. Capture quality and match
/// score are derived from a stable hash of <c>(applicantId|modality)</c>, so
/// the same applicant always produces the same template and a believable,
/// repeatable score. No randomness, no device — safe for demos and tests.
/// </summary>
public sealed class SimulatedBiometricDeviceGateway : IBiometricDeviceGateway
{
    public Task<BiometricCaptureResult> CaptureAsync(BiometricCaptureRequest request, CancellationToken ct)
    {
        var hash = Fnv1a($"{request.ApplicantId}|{request.Modality}|capture");
        var quality = 82 + (int)(hash % 18);          // 82..99
        var templateRef = $"tmpl/{request.Modality}/{request.ApplicantId}";
        return Task.FromResult(new BiometricCaptureResult(templateRef, quality, LivenessConfirmed: true));
    }

    public Task<BiometricMatchResult> MatchAsync(BiometricMatchRequest request, CancellationToken ct)
    {
        // Barcode is a hard token match, not a biometric comparison.
        if (string.Equals(request.Modality, "barcode", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(new BiometricMatchResult(IsMatch: true, Confidence: 100, Score: 100));
        }

        var hash = Fnv1a($"{request.ApplicantId}|{request.Modality}|match");
        var score = 70 + (int)(hash % 30);            // 70..99 → spread across match/manual/no-match
        return Task.FromResult(new BiometricMatchResult(IsMatch: score >= 88, Confidence: score, Score: score));
    }

    private static uint Fnv1a(string value)
    {
        const uint prime = 16777619u;
        var hash = 2166136261u;
        foreach (var c in value)
        {
            hash ^= c;
            hash *= prime;
        }
        return hash;
    }
}
