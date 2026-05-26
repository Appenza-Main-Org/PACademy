namespace PACademy.Modules.IdentityApplicant.Application.Moi;

/// <summary>
/// MOI identity-verification payload — matches the frontend
/// <c>MoiApplicantSession</c> interface in
/// <c>features/applicant-portal/lib/moi-session.mock.ts</c> verbatim.
/// </summary>
public sealed record MoiApplicantSessionDto(
    string ApplicantId,
    string FullName,
    string NationalId,
    string DateOfBirth,
    string DateOfBirthAr,
    string Gender,
    string Mobile,
    string Email,
    string BirthGovernorate,
    string BirthDistrict,
    string Religion);
