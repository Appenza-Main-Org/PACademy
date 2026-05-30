using Microsoft.EntityFrameworkCore;
using PACademy.Modules.IdentityApplicant.Application.Moi;
using PACademy.Shared.Contracts;
using PACademy.Shared.Domain.Identity;

namespace PACademy.Modules.IdentityApplicant.Application.Auth;

/// <summary>
/// Applicant login — NID + mobile direct lookup. Behaviour gates
/// approved 2026-05-21:
///
///  1. Validate NID (14 digits) + mobile (01[0125]XXXXXXXX) format.
///  2. If an applicants row exists with that NID:
///       • mobile must match the stored value → else INVALID_CREDENTIALS.
///       • else issue token for that row.
///  3. If no row exists:
///       • call MOI verify.
///       • MOI session returned: mobile must match MOI's mobile, then
///         auto-create the applicant row from MOI data + issue token.
///       • MOI returned 404 (not_found, e.g. Mohamed): auto-create a
///         minimal row from the supplied (NID, mobile) — manual-entry
///         path. Issue token.
///
/// Returns <c>(AuthUserDto, null)</c> on success or <c>(null, errorCode)</c>
/// when the request fails predictably.
/// </summary>
public sealed class LoginUseCase(
    IApplicantsDbContext db,
    IMoiClient moi,
    IJwtTokenService jwt)
{
    private static readonly System.Text.RegularExpressions.Regex NidRegex = new("^[0-9]{14}$");
    private static readonly System.Text.RegularExpressions.Regex MobileRegex = new("^01[0125][0-9]{8}$");

    public async Task<(AuthUserDto? Ok, string? ErrorCode)> ExecuteAsync(
        LoginRequest request,
        CancellationToken ct = default)
    {
        var nid = request.Username?.Trim() ?? string.Empty;
        var mobile = request.Password?.Trim() ?? string.Empty;

        if (!NidRegex.IsMatch(nid) || !MobileRegex.IsMatch(mobile))
            return (null, ErrorCodes.InvalidCredentials);

        var existing = await db.Applicants
            .FirstOrDefaultAsync(a => a.NationalId == nid, ct);

        if (existing is not null)
        {
            if (!string.Equals(existing.PhoneNumber, mobile, StringComparison.Ordinal))
                return (null, ErrorCodes.InvalidCredentials);

            // Self-heal rows created before NID-derivation existed (bare
            // CreateManual rows whose name/DOB/birthplace were left blank).
            // The account already passed the mobile check above, so no
            // impersonation risk in backfilling the read-only MOI fields.
            if (existing.IsIdentityIncomplete)
            {
                var identity = await ResolveIdentityAsync(nid, mobile, ct);
                if (identity is not null)
                {
                    DateOnly.TryParse(identity.DateOfBirth, out var enrichDob);
                    existing.EnrichIdentity(
                        fullName: identity.FullName,
                        email: identity.Email,
                        gender: identity.Gender,
                        religion: identity.Religion,
                        dateOfBirth: enrichDob == default ? null : enrichDob,
                        birthGovernorate: identity.BirthGovernorate,
                        birthDistrict: identity.BirthDistrict);
                    await db.SaveChangesAsync(ct);
                }
            }
            return (BuildAuth(existing), null);
        }

        // Unknown NID — call MOI.
        var moiSession = await moi.VerifyAsync(nid, ct);
        Applicant created;
        if (moiSession is not null)
        {
            if (!string.Equals(moiSession.Mobile, mobile, StringComparison.Ordinal))
                return (null, ErrorCodes.InvalidCredentials);

            DateOnly dob;
            DateOnly.TryParse(moiSession.DateOfBirth, out dob);

            created = Applicant.CreateFromMoi(
                nationalId: moiSession.NationalId,
                phoneNumber: moiSession.Mobile,
                fullName: moiSession.FullName,
                email: moiSession.Email,
                gender: moiSession.Gender,
                religion: moiSession.Religion,
                dateOfBirth: dob,
                birthGovernorate: moiSession.BirthGovernorate,
                birthDistrict: moiSession.BirthDistrict);
        }
        else
        {
            // not_found-in-MOI. The MOI directory has no authoritative
            // record, but the NID itself encodes date-of-birth, gender and
            // governorate — derive those (plus a placeholder name) so the
            // applicant arrives with بيانات المتقدم pre-filled instead of a
            // blank row they'd have to retype. Mirrors the frontend
            // mockMoiVerifyNid fallback. The supplied mobile is trusted as-is
            // (a derived record has no authoritative number to match).
            var derived = NidIdentityDeriver.Derive(nid, mobile);
            if (derived is not null)
            {
                DateOnly.TryParse(derived.DateOfBirth, out var derivedDob);
                created = Applicant.CreateFromMoi(
                    nationalId: derived.NationalId,
                    phoneNumber: mobile,
                    fullName: derived.FullName,
                    email: derived.Email,
                    gender: derived.Gender,
                    religion: derived.Religion,
                    dateOfBirth: derivedDob,
                    birthGovernorate: derived.BirthGovernorate,
                    birthDistrict: derived.BirthDistrict);
            }
            else
            {
                // NID couldn't be parsed (impossible date) — minimal row.
                created = Applicant.CreateManual(nid, mobile);
            }
        }

        db.Applicants.Add(created);
        await db.SaveChangesAsync(ct);
        return (BuildAuth(created), null);
    }

    /// <summary>
    /// Resolve the identity to fill onto an existing incomplete row: the
    /// authoritative MOI record when one exists, otherwise the NID-derived
    /// fallback. Returns null only when the NID can't be parsed at all.
    /// </summary>
    private async Task<Moi.MoiApplicantSessionDto?> ResolveIdentityAsync(
        string nid, string mobile, CancellationToken ct)
        => await moi.VerifyAsync(nid, ct) ?? NidIdentityDeriver.Derive(nid, mobile);

    private AuthUserDto BuildAuth(Applicant a)
    {
        var (token, issuedAt) = jwt.Issue(a);
        return new AuthUserDto(
            Id: a.Id,
            Name: a.FullName ?? "متقدم",
            Role: "applicant",
            RoleLabel: "متقدم",
            Apps: new[] { "applicant" },
            Permissions: new[] { "applicant:portal" },
            Token: token,
            LoggedInAt: issuedAt);
    }
}
