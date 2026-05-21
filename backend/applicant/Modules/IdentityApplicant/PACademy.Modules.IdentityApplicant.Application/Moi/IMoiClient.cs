namespace PACademy.Modules.IdentityApplicant.Application.Moi;

/// <summary>
/// External MOI (وزارة الداخلية) identity-verification client.
/// Two implementations:
///   • <c>MoiMockClient</c> — Dev/Demo, returns seeded payloads for the
///     4 known demo NIDs (Ahmed, Khaled, Mohamed-404, Youssef).
///   • <c>MoiHttpClient</c> (TODO) — Prod, real upstream call.
///
/// Bound in <c>IdentityApplicantModule.AddIdentityApplicantModule</c>
/// via <c>configuration["Mock:MoiClient"]</c>. Dev defaults to true.
/// </summary>
public interface IMoiClient
{
    /// <summary>
    /// Returns the MOI session payload for the NID, or <c>null</c> if
    /// MOI reports the NID is unknown (Mohamed-style demo case).
    /// </summary>
    Task<MoiApplicantSessionDto?> VerifyAsync(string nationalId, CancellationToken ct = default);
}
