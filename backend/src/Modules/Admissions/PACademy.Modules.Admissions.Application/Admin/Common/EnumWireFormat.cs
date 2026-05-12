using System.Text.RegularExpressions;

namespace PACademy.Modules.Admissions.Application.Admin.Common;

/// <summary>
/// Converts a C# PascalCase enum name to the snake_case string the frontend
/// expects on the wire (e.g., <c>SportsFemale → "sports_female"</c>,
/// <c>NotStarted → "not_started"</c>, <c>Merge → "merge"</c>).
///
/// Used by spec-009 mappers (MergeSplit, TotalScore, WizardStatus) where the
/// DTO carries an enum as <c>string</c> rather than the enum type. Single-word
/// enum values come out lowercase; multi-word values get one underscore per
/// case boundary.
/// </summary>
internal static class EnumWireFormat
{
    private static readonly Regex CaseBoundary = new("([a-z0-9])([A-Z])", RegexOptions.Compiled);

    public static string ToSnakeCase(string pascalCase) =>
        CaseBoundary.Replace(pascalCase, "$1_$2").ToLowerInvariant();

    public static string ToSnakeCase<T>(T value) where T : struct, System.Enum =>
        ToSnakeCase(value.ToString());
}
