using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Modules.IdentityApplicant.Infrastructure;

/// <summary>
/// Dev/Demo MOI client. Hardcodes the 4 demo NIDs verbatim from
/// <c>frontend/src/features/applicant-portal/lib/moi-session.mock.ts</c>:
///   • 30412180103456 → Ahmed (eligible)
///   • 28503150103456 → Khaled (ineligible — frontend decides)
///   • 30506200103456 → null (Mohamed, not_found path)
///   • 30407010103456 → Youssef (submitted demo)
///
/// Production swaps this for <c>MoiHttpClient</c> behind the same
/// <see cref="IMoiClient"/> interface — no consumer change.
/// </summary>
public sealed class MoiMockClient : IMoiClient
{
    private static readonly Dictionary<string, MoiApplicantSessionDto> Seed = new()
    {
        ["30412180103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026000",
            FullName: "أحمد محمد إبراهيم سعد",
            NationalId: "30412180103456",
            DateOfBirth: "2004-12-18",
            DateOfBirthAr: "١٨ ديسمبر ٢٠٠٤",
            Gender: "male",
            Mobile: "01012345678",
            Email: "ahmed.ibrahim.saad@gmail.com",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مدينة نصر",
            Religion: "مسلم"),

        ["28503150103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026-KH",
            FullName: "خالد عبد الرحمن سامي مصطفى",
            NationalId: "28503150103456",
            DateOfBirth: "1985-03-15",
            DateOfBirthAr: "١٥ مارس ١٩٨٥",
            Gender: "male",
            Mobile: "01098765432",
            Email: "khaled.samy@gmail.com",
            BirthGovernorate: "الإسكندرية",
            BirthDistrict: "سيدي جابر",
            Religion: "مسلم"),

        ["30407010103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026099",
            FullName: "يوسف عمر فاروق منصور",
            NationalId: "30407010103456",
            DateOfBirth: "2004-07-01",
            DateOfBirthAr: "١ يوليو ٢٠٠٤",
            Gender: "male",
            Mobile: "01098765432",
            Email: "youssef.mansour@example.eg",
            BirthGovernorate: "الجيزة",
            BirthDistrict: "الدقي",
            Religion: "مسلم"),
        // 30506200103456 (Mohamed) intentionally absent → null verdict.
    };

    public Task<MoiApplicantSessionDto?> VerifyAsync(string nationalId, CancellationToken ct = default)
        => Task.FromResult(Seed.TryGetValue(nationalId, out var session) ? session : null);
}
