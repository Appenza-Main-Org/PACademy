namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// ZKBioTime / BioTime 8.x platform gateway. Active when
/// <c>Biometric:Mode=zkbiotime</c>. Maps PACademy's two device primitives onto
/// the endpoints the platform actually exposes (see <see cref="ZkBioTimeClient"/>):
///
///   • <b>Capture (enroll)</b> → ensure a personnel record exists for the
///     applicant. ZKBioTime has no template-capture API; the biometric is
///     enrolled on the terminal against this <c>emp_code</c>, so "capture" here
///     guarantees the binding record and returns a stable template ref.
///
///   • <b>Match (1:1 verify)</b> → the platform has no synchronous verify call;
///     matching happens on the terminal and surfaces as a transaction. We poll
///     the punch stream for a recent punch by this applicant: a punch within the
///     configured window ⇒ match; none ⇒ no_match. Barcode stays a hard token
///     match (resolved upstream), consistent with the simulated gateway.
///
/// Throws <see cref="BiometricDeviceException"/> only on transport/config
/// failure — a clean "no recent punch" returns a no-match result, not an error.
/// </summary>
public sealed class ZkBioTimeBiometricDeviceGateway(ZkBioTimeClient client, IConfiguration config)
    : IBiometricDeviceGateway
{
    private int VerifyWindowSeconds =>
        int.TryParse(config["Biometric:ZkBioTime:VerifyWindowSeconds"], out var n) && n > 0 ? n : 90;

    public async Task<BiometricCaptureResult> CaptureAsync(BiometricCaptureRequest request, CancellationToken ct)
    {
        // Device emp_code must be a short, device-acceptable id (national id) —
        // a 36-char applicant GUID is rejected by the platform with HTTP 400.
        var empCode = string.IsNullOrWhiteSpace(request.EmpCode) ? request.ApplicantId : request.EmpCode;
        // No template-capture endpoint on the platform — ensure the personnel
        // record so the terminal can enroll the biometric against this emp_code.
        var employee = await client.EnsureEmployeeAsync(empCode, request.DisplayName ?? empCode, ct);
        // The device-assigned `id` is the canonical linkage key (not the national id).
        var deviceEmpId = employee["id"]?.ToString();
        var templateRef = $"zkbio:emp/{empCode}/{request.Modality}";
        return new BiometricCaptureResult(templateRef, Quality: 100, LivenessConfirmed: true, DeviceEmpId: deviceEmpId);
    }

    public async Task<BiometricMatchResult> MatchAsync(BiometricMatchRequest request, CancellationToken ct)
    {
        // Barcode is a hard token match, not a biometric comparison.
        if (string.Equals(request.Modality, "barcode", StringComparison.OrdinalIgnoreCase))
            return new BiometricMatchResult(IsMatch: true, Confidence: 100, Score: 100);

        var empCode = string.IsNullOrWhiteSpace(request.EmpCode) ? request.ApplicantId : request.EmpCode;
        var punches = await client.GetRecentTransactionsAsync(empCode, VerifyWindowSeconds, request.TerminalSn, ct);

        // Require the recent punch to be of the requested modality so "verify by
        // face" only matches a face punch and "verify by fingerprint" a finger
        // punch. ZK verify_type on this platform: 1 = fingerprint, 15 = face.
        var expected = ExpectedVerifyTypes(request.Modality);
        var matched = expected is null
            ? punches.Count > 0
            : punches.Any(p => expected.Contains(p.VerifyType));

        return matched
            ? new BiometricMatchResult(IsMatch: true, Confidence: 100, Score: 100)
            : new BiometricMatchResult(IsMatch: false, Confidence: 0, Score: 0);
    }

    /// <summary>ZK verify_type codes per modality; null = accept any punch.</summary>
    private static int[]? ExpectedVerifyTypes(string? modality) => modality?.ToLowerInvariant() switch
    {
        "face" => [15],
        "fingerprint" => [1],
        _ => null,
    };
}
