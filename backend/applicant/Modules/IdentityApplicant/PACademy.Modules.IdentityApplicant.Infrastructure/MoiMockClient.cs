using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Modules.IdentityApplicant.Infrastructure;

/// <summary>
/// Dev/Demo MOI client. Hardcodes all demo NIDs verbatim from
/// <c>frontend/src/features/applicant-portal/lib/moi-session.mock.ts</c>.
///
/// Seeded users (NID → mobile):
///   30412180103456 → 01012345678 Ahmed  — eligible, قسم عام
///   28503150103456 → 01098765432 Khaled — ineligible (over age)
///   30407010103456 → 01098765432 Youssef (submitted demo)
///   30501010103456 → 01098765432 Adham  — eligible, وثيقة تعارف fillable
///   30501010203456 → 01098765433 Selim  — eligible, وثيقة تعارف expired
///   30502010103456 → 01098765434 Bassem — eligible, ضباط متخصصون
///   30503010103456 → 01098765435 Laith  — eligible, ليسانس حقوق
///   30606060123451 → 01066000101 Omar   — UAT full-cycle, قسم عام
///   29202150167831 → 01066000102 Hassan — UAT full-cycle, ضباط متخصصون
///   29809220145624 → 01066000103 Mariam — UAT full-cycle, ليسانس حقوق
///   30103150246828 → 01066000104 Nourhan — UAT closed-category path
///
/// 30506200103456 (Mohamed) intentionally absent → null verdict (not_found).
///
/// Production swaps this for <c>MoiHttpClient</c> — no consumer change.
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

        ["30501010103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026731",
            FullName: "أدهم شريف كامل النجار",
            NationalId: "30501010103456",
            DateOfBirth: "2005-01-01",
            DateOfBirthAr: "١ يناير ٢٠٠٥",
            Gender: "male",
            Mobile: "01098765432",
            Email: "karim.elaqqad@example.eg",
            BirthGovernorate: "الجيزة",
            BirthDistrict: "الدقي",
            Religion: "مسلم"),

        ["30501010203456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026732",
            FullName: "سليم أيمن نادر الخطيب",
            NationalId: "30501010203456",
            DateOfBirth: "2005-01-01",
            DateOfBirthAr: "١ يناير ٢٠٠٥",
            Gender: "male",
            Mobile: "01098765433",
            Email: "karim.elaqqad.expired@example.eg",
            BirthGovernorate: "الجيزة",
            BirthDistrict: "الدقي",
            Religion: "مسلم"),

        ["30502010103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026733",
            FullName: "باسم عادل مراد الحداد",
            NationalId: "30502010103456",
            DateOfBirth: "1990-02-15",
            DateOfBirthAr: "١٥ فبراير ١٩٩٠",
            Gender: "male",
            Mobile: "01098765434",
            Email: "mahmoud.elaqqad.specialized@example.eg",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مدينة نصر",
            Religion: "مسلم"),

        ["30503010103456"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-2026734",
            FullName: "ليث حسام فوزي مراد",
            NationalId: "30503010103456",
            DateOfBirth: "1988-09-22",
            DateOfBirthAr: "٢٢ سبتمبر ١٩٨٨",
            Gender: "male",
            Mobile: "01098765435",
            Email: "youssef.faroq.law@example.eg",
            BirthGovernorate: "الإسكندرية",
            BirthDistrict: "سيدي جابر",
            Religion: "مسلم"),

        ["30606060123451"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-UAT-GEN-2026",
            FullName: "عمر مصطفى عبد العزيز الشيخ",
            NationalId: "30606060123451",
            DateOfBirth: "2006-06-06",
            DateOfBirthAr: "٦ يونيو ٢٠٠٦",
            Gender: "male",
            Mobile: "01066000101",
            Email: "uat.general.123451@example.eg",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مدينة نصر",
            Religion: "مسلم"),

        ["29202150167831"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-UAT-SPEC-2026",
            FullName: "حسن ياسر كمال عبد الحميد",
            NationalId: "29202150167831",
            DateOfBirth: "1992-02-15",
            DateOfBirthAr: "١٥ فبراير ١٩٩٢",
            Gender: "male",
            Mobile: "01066000102",
            Email: "uat.specialized.167831@example.eg",
            BirthGovernorate: "القاهرة",
            BirthDistrict: "مصر الجديدة",
            Religion: "مسلم"),

        ["29809220145624"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-UAT-LAW-2026",
            FullName: "مريم عادل محمد منصور",
            NationalId: "29809220145624",
            DateOfBirth: "1998-09-22",
            DateOfBirthAr: "٢٢ سبتمبر ١٩٩٨",
            Gender: "female",
            Mobile: "01066000103",
            Email: "uat.law.145624@example.eg",
            BirthGovernorate: "الإسكندرية",
            BirthDistrict: "سيدي جابر",
            Religion: "مسلم"),

        ["30103150246828"] = new MoiApplicantSessionDto(
            ApplicantId: "APP-UAT-PE-2026",
            FullName: "نورهان أحمد حسن عبد اللطيف",
            NationalId: "30103150246828",
            DateOfBirth: "2001-03-15",
            DateOfBirthAr: "١٥ مارس ٢٠٠١",
            Gender: "female",
            Mobile: "01066000104",
            Email: "uat.physical.246828@example.eg",
            BirthGovernorate: "الجيزة",
            BirthDistrict: "الدقي",
            Religion: "مسلم"),

        // 30506200103456 (Mohamed) intentionally absent → null verdict.
    };

    public Task<MoiApplicantSessionDto?> VerifyAsync(string nationalId, CancellationToken ct = default)
        => Task.FromResult(Seed.TryGetValue(nationalId, out var session) ? session : null);
}
