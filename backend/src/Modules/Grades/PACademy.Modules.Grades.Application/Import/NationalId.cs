using System.Text.RegularExpressions;

namespace PACademy.Modules.Grades.Application.Import;

internal static partial class NationalId
{
    [GeneratedRegex(@"^\d{14}$")]
    private static partial Regex Fourteen();

    public static bool IsValid(string? id)
    {
        if (string.IsNullOrEmpty(id) || !Fourteen().IsMatch(id)) return false;
        var mm = int.Parse(id.AsSpan(3, 2));
        var dd = int.Parse(id.AsSpan(5, 2));
        return mm is >= 1 and <= 12 && dd is >= 1 and <= 31;
    }
}
