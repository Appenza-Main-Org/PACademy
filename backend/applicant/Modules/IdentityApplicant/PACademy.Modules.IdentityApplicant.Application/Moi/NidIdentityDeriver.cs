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
    private static readonly Dictionary<string, string> GovMap = new()
    {
        ["01"] = "محافظة القاهرة", ["02"] = "محافظة الإسكندرية", ["03"] = "محافظة بورسعيد", ["04"] = "محافظة السويس",
        ["11"] = "محافظة دمياط", ["12"] = "محافظة الدقهلية", ["13"] = "محافظة الشرقية", ["14"] = "محافظة القليوبية",
        ["15"] = "محافظة كفر الشيخ", ["16"] = "محافظة الغربية", ["17"] = "محافظة المنوفية", ["18"] = "محافظة البحيرة",
        ["19"] = "محافظة الإسماعيلية", ["21"] = "محافظة الجيزة", ["22"] = "محافظة بني سويف", ["23"] = "محافظة الفيوم",
        ["24"] = "محافظة المنيا", ["25"] = "محافظة أسيوط", ["26"] = "محافظة سوهاج", ["27"] = "محافظة قنا",
        ["28"] = "محافظة أسوان", ["29"] = "محافظة الأقصر", ["31"] = "محافظة البحر الأحمر", ["32"] = "محافظة الوادي الجديد",
        ["33"] = "محافظة مطروح", ["34"] = "محافظة شمال سيناء", ["35"] = "محافظة جنوب سيناء", ["88"] = "خارج الجمهورية",
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

        var lastDigit = sequence[^1] - '0';
        var gender = lastDigit % 2 == 0 ? "female" : "male";
        // Gender-matched name — the NID's gender digit is authoritative, so
        // a female NID must not get a male name (which would land the applicant in
        // a (طالبات)/(طلاب) committee that contradicts the name).
        var fullName = ArabicNameGenerator.FullNameFor(nationalId, gender);
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
            BirthDistrict: string.Empty,
            Religion: "مسلم");
    }
}
