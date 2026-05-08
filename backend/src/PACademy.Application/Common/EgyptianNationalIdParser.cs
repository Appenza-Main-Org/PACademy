namespace PACademy.Application.Common;

/// <summary>
/// Validates and parses Egypt's 14-digit national ID.
/// Format: CYYMMDDGGGGGSD
///   C  = century digit (2 = 1900s, 3 = 2000s)
///   YY = year of birth (last 2 digits)
///   MM = birth month
///   DD = birth day
///   GGGGG = governorate + sequence
///   S  = gender (odd = male, even = female)
///   D  = check digit
/// </summary>
public static class EgyptianNationalIdParser
{
    public record ParseResult(bool IsValid, DateTime? DateOfBirth, string? Gender, string? Error);

    public static ParseResult Parse(string nationalId)
    {
        if (string.IsNullOrWhiteSpace(nationalId) || nationalId.Length != 14)
            return new ParseResult(false, null, null, "الرقم القومي يجب أن يتكوّن من 14 رقماً.");

        if (!nationalId.All(char.IsAsciiDigit))
            return new ParseResult(false, null, null, "الرقم القومي يجب أن يحتوي على أرقام فقط.");

        var centuryDigit = nationalId[0] - '0';
        int century = centuryDigit switch
        {
            2 => 1900,
            3 => 2000,
            _ => -1,
        };

        if (century == -1)
            return new ParseResult(false, null, null, "رقم القرن غير صحيح (يجب أن يكون 2 أو 3).");

        if (!int.TryParse(nationalId[1..3], out var year) ||
            !int.TryParse(nationalId[3..5], out var month) ||
            !int.TryParse(nationalId[5..7], out var day))
            return new ParseResult(false, null, null, "تاريخ الميلاد في الرقم القومي غير صحيح.");

        DateTime dob;
        try
        {
            dob = new DateTime(century + year, month, day);
        }
        catch (ArgumentOutOfRangeException)
        {
            return new ParseResult(false, null, null, "تاريخ الميلاد في الرقم القومي خارج النطاق المسموح.");
        }

        // Gender: 13th digit (index 12) — odd = male, even = female
        var genderDigit = nationalId[12] - '0';
        var gender = genderDigit % 2 == 1 ? "male" : "female";

        return new ParseResult(true, dob, gender, null);
    }

    public static bool IsValid(string nationalId) => Parse(nationalId).IsValid;
}
