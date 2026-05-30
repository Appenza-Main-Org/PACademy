using System.Globalization;

namespace PACademy.Modules.IdentityApplicant.Application.Moi;

/// <summary>
/// Derives a plausible MOI identity from the structure of a 14-digit
/// Egyptian National ID when the MOI directory has no authoritative record
/// for it. Mirrors the frontend fallback in
/// <c>frontend/src/features/applicant-portal/lib/moi-session.mock.ts</c>
/// (<c>mockMoiVerifyNid</c> + <c>parseNidStructure</c>) so demo/test NIDs
/// that aren't in the seed still arrive with date-of-birth, gender,
/// governorate, name and religion pre-filled — the applicant should never
/// have to retype data the NID already encodes.
///
/// The mobile is NOT derived here: the login flow trusts the mobile the
/// applicant supplied on the form, since a derived record has no
/// authoritative number to match against.
/// </summary>
public static class NidIdentityDeriver
{
    private static readonly string[] NamePool =
    [
        "محمد إبراهيم سعد",
        "يوسف أحمد محمد",
        "علي حسن طه",
        "عمر مصطفى الشيخ",
        "كريم مجدي عبد الله",
        "محمود فؤاد العقاد",
    ];

    private static readonly Dictionary<string, string> GovMap = new()
    {
        ["01"] = "القاهرة", ["02"] = "الإسكندرية", ["03"] = "بورسعيد", ["04"] = "السويس",
        ["11"] = "دمياط", ["12"] = "الدقهلية", ["13"] = "الشرقية", ["14"] = "القليوبية",
        ["15"] = "كفر الشيخ", ["16"] = "الغربية", ["17"] = "المنوفية", ["18"] = "البحيرة",
        ["19"] = "الإسماعيلية", ["21"] = "الجيزة", ["22"] = "بني سويف", ["23"] = "الفيوم",
        ["24"] = "المنيا", ["25"] = "أسيوط", ["26"] = "سوهاج", ["27"] = "قنا",
        ["28"] = "أسوان", ["29"] = "الأقصر", ["31"] = "البحر الأحمر", ["32"] = "الوادي الجديد",
        ["33"] = "مرسى مطروح", ["34"] = "شمال سيناء", ["35"] = "جنوب سيناء", ["88"] = "خارج الجمهورية",
    };

    /// <summary>
    /// Returns a derived <see cref="MoiApplicantSessionDto"/> for a valid
    /// NID, or <c>null</c> when the NID is malformed or encodes an
    /// impossible date. <paramref name="mobile"/> is echoed back verbatim.
    /// </summary>
    public static MoiApplicantSessionDto? Derive(string nationalId, string mobile)
    {
        if (nationalId.Length != 14 || !nationalId.All(char.IsDigit)) return null;

        var century = nationalId[0] == '2' ? 1900 : 2000;
        var yy = int.Parse(nationalId.Substring(1, 2), CultureInfo.InvariantCulture);
        var mm = int.Parse(nationalId.Substring(3, 2), CultureInfo.InvariantCulture);
        var dd = int.Parse(nationalId.Substring(5, 2), CultureInfo.InvariantCulture);
        var gov = nationalId.Substring(7, 2);
        var sequence = nationalId.Substring(9, 4);

        if (mm is < 1 or > 12 || dd is < 1 or > 31) return null;

        DateOnly dob;
        try
        {
            dob = new DateOnly(century + yy, mm, dd);
        }
        catch (ArgumentOutOfRangeException)
        {
            return null;
        }

        var hash = Djb2(nationalId);
        var lastDigit = sequence[^1] - '0';
        var gender = lastDigit % 2 == 0 ? "female" : "male";
        var fullName = NamePool[hash % NamePool.Length];
        var governorate = GovMap.GetValueOrDefault(gov, "غير محددة");
        var arCulture = CultureInfo.GetCultureInfo("ar-EG");

        return new MoiApplicantSessionDto(
            ApplicantId: "APP-MOI-DERIVED",
            FullName: fullName,
            NationalId: nationalId,
            DateOfBirth: dob.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DateOfBirthAr: dob.ToDateTime(TimeOnly.MinValue).ToString("d MMMM yyyy", arCulture),
            Gender: gender,
            Mobile: mobile,
            Email: $"applicant.{nationalId[^4..]}@example.eg",
            BirthGovernorate: governorate,
            BirthDistrict: "مركز التقدم",
            Religion: "مسلم");
    }

    private static int Djb2(string s)
    {
        var h = 5381;
        foreach (var c in s)
            h = (h * 33 + c) & 0x7fffffff;
        return h;
    }
}
