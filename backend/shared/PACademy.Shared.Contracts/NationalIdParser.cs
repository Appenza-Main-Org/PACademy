namespace PACademy.Shared.Contracts;

public enum EgyptianNationalIdGender
{
    Male,
    Female
}

public sealed record EgyptianNationalIdInfo(
    string NationalId,
    DateOnly BirthDate,
    EgyptianNationalIdGender Gender,
    string GenderAr,
    string GovernorateCode);

public static class NationalIdParser
{
    public static EgyptianNationalIdInfo ParseEgyptianNationalId(string nationalId)
    {
        if (!TryParseEgyptianNationalId(nationalId, out var info, out var error))
        {
            throw new NationalIdFormatException(error ?? "الرقم القومي غير صحيح");
        }

        return info;
    }

    public static bool TryParseEgyptianNationalId(
        string? nationalId,
        out EgyptianNationalIdInfo info,
        out string? error)
    {
        info = null!;
        var normalized = nationalId?.Trim();
        if (normalized is not { Length: 14 } || !normalized.All(char.IsDigit))
        {
            error = "الرقم القومي يجب أن يتكون من 14 رقمًا";
            return false;
        }

        var century = normalized[0] switch
        {
            '2' => 1900,
            '3' => 2000,
            _ => 0
        };
        if (century == 0)
        {
            error = "رقم قرن الميلاد في الرقم القومي غير صحيح";
            return false;
        }

        var year = century + int.Parse(normalized[1..3]);
        var month = int.Parse(normalized[3..5]);
        var day = int.Parse(normalized[5..7]);
        if (!DateOnly.TryParseExact($"{year:0000}-{month:00}-{day:00}", "yyyy-MM-dd", out var birthDate))
        {
            error = "تاريخ الميلاد داخل الرقم القومي غير صحيح";
            return false;
        }

        if (birthDate > DateOnly.FromDateTime(DateTime.UtcNow.Date))
        {
            error = "تاريخ الميلاد داخل الرقم القومي يقع في المستقبل";
            return false;
        }

        var governorateCode = normalized[7..9];
        if (governorateCode == "00")
        {
            error = "كود محافظة الميلاد داخل الرقم القومي غير صحيح";
            return false;
        }

        var genderDigit = normalized[12] - '0';
        var gender = genderDigit % 2 == 1
            ? EgyptianNationalIdGender.Male
            : EgyptianNationalIdGender.Female;

        info = new EgyptianNationalIdInfo(
            normalized,
            birthDate,
            gender,
            gender == EgyptianNationalIdGender.Male ? "ذكر" : "أنثى",
            governorateCode);
        error = null;
        return true;
    }

    public static int CalculateAge(DateOnly birthDate, DateOnly referenceDate)
    {
        var age = referenceDate.Year - birthDate.Year;
        if (referenceDate < birthDate.AddYears(age)) age--;
        return age;
    }
}

public sealed class NationalIdFormatException(string message) : Exception(message);
