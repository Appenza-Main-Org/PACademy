namespace PACademy.Admin.Api.Modules.Identity.Moi;

/// <summary>
/// MOI SSO contracts — mirror the ministry's two-call protocol exactly so the
/// simulated gateway can be swapped for the real one with no controller change.
///
///   STEP 1  POST /token                        (x-www-form-urlencoded)
///           userName, password, grant_type=password  →  MoiTokenResponse
///   STEP 2  POST /api/moiMemberApi/ValidateLogin (application/json, Bearer token)
///           { Email, Token }                          →  MoiValidateLoginResponse
///
/// See docs / the integration diagram for the canonical shapes.
/// </summary>
public sealed record MoiTokenResponse(string AccessToken, string TokenType, int ExpiresIn);

/// <summary>The `data` object returned by ValidateLogin — the member's real identity.</summary>
public sealed record MoiMemberData(
    string FullName,
    string CardId,
    string? CardFactoryNumber,
    string Email,
    string? MotherFirstName,
    string Mobile,
    int GovernorateId,
    string? Address,
    string? JobTitle);

/// <summary>Envelope returned by ValidateLogin: status 1 = ok, data populated.</summary>
public sealed record MoiValidateLoginResponse(int Status, string? Message, MoiMemberData? Data);

/// <summary>Raised when MOI rejects the credentials/token. Mapped to 401 by the controller.</summary>
public sealed class MoiAuthException(string message) : Exception(message);
