namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Activation router for the device seam. Routes enroll/verify through the
/// ZKBioTime gateway whenever a server connection has been configured (from the
/// admin screen or appsettings), and otherwise falls back to the mode-default
/// gateway (<see cref="SimulatedBiometricDeviceGateway"/>, or
/// <see cref="RealBiometricDeviceGateway"/> when <c>Biometric:Mode=real</c>).
///
/// This makes the admin-entered connection the live activation switch: saving a
/// valid ZKBioTime server turns the integration on with no redeploy and no
/// <c>Biometric:Mode</c> env var. The check is per call (config can change at
/// runtime) and only costs a cached config read.
/// </summary>
public sealed class AutoBiometricDeviceGateway(
    ZkBioTimeClient zkClient,
    ZkBioTimeBiometricDeviceGateway zk,
    IBiometricDeviceGateway fallback) : IBiometricDeviceGateway
{
    public async Task<BiometricCaptureResult> CaptureAsync(BiometricCaptureRequest request, CancellationToken ct)
        => await zkClient.IsConfiguredAsync(ct)
            ? await zk.CaptureAsync(request, ct)
            : await fallback.CaptureAsync(request, ct);

    public async Task<BiometricMatchResult> MatchAsync(BiometricMatchRequest request, CancellationToken ct)
        => await zkClient.IsConfiguredAsync(ct)
            ? await zk.MatchAsync(request, ct)
            : await fallback.MatchAsync(request, ct);
}
