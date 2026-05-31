namespace PACademy.Admin.Api.Modules.Identity.Moi;

/// <summary>
/// The MOI authentication gateway. One method per MOI call.
///
/// Two implementations exist behind this seam:
///   • <see cref="SimulatedMoiAuthGateway"/> — default; validates against the
///     local admin user store. Active until the ministry API is live.
///   • <see cref="RealMoiAuthGateway"/> — issues the real HTTP calls. Activated by
///     setting <c>Moi:Mode=real</c> in configuration.
///
/// Callers (AuthController) only ever see this interface, so flipping the mode
/// flag is the entire migration to the real API.
/// </summary>
public interface IMoiAuthGateway
{
    /// <summary>STEP 1 — exchange username + password for an access token.</summary>
    Task<MoiTokenResponse> GetAccessTokenAsync(string userName, string password, CancellationToken ct);

    /// <summary>STEP 2 — exchange email + access token for the member's real data.</summary>
    Task<MoiValidateLoginResponse> ValidateLoginAsync(string email, string token, CancellationToken ct);
}
