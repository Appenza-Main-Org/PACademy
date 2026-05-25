using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.Admissions.Eligibility;

internal static class EligibilityJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static JsonObject ParseObject(string json)
    {
        return JsonNode.Parse(json)?.AsObject() ?? [];
    }

    public static JsonObject Clone(JsonObject value)
    {
        return JsonNode.Parse(value.ToJsonString(Options))?.AsObject() ?? [];
    }

    public static string? StringProp(JsonObject? obj, string name)
    {
        if (obj is null || !obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<string>()?.Trim();
        }
        catch (InvalidOperationException)
        {
            return node.ToString().Trim();
        }
    }

    public static string? FirstString(JsonObject? obj, params string[] names)
    {
        foreach (var name in names)
        {
            var value = StringProp(obj, name);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }

    public static JsonObject? ObjectProp(JsonObject? obj, string name)
    {
        return obj is not null &&
            obj.TryGetPropertyValue(name, out var node) &&
            node is JsonObject child
                ? child
                : null;
    }

    public static JsonArray? ArrayProp(JsonObject? obj, string name)
    {
        return obj is not null &&
            obj.TryGetPropertyValue(name, out var node) &&
            node is JsonArray child
                ? child
                : null;
    }

    public static int? IntProp(JsonObject? obj, string name)
    {
        if (obj is null || !obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<int>();
        }
        catch (InvalidOperationException)
        {
            return int.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }

    public static bool? BoolProp(JsonObject? obj, string name)
    {
        if (obj is null || !obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<bool>();
        }
        catch (InvalidOperationException)
        {
            return bool.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }

    public static decimal? DecimalProp(JsonObject? obj, string name)
    {
        if (obj is null || !obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<decimal>();
        }
        catch (InvalidOperationException)
        {
            return decimal.TryParse(node.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : null;
        }
    }

    public static IReadOnlyList<string> StringArray(string json)
    {
        return JsonSerializer.Deserialize<List<string>>(json, Options) ?? [];
    }

    public static IReadOnlyList<string> StringArray(JsonObject? obj, string name)
    {
        var array = ArrayProp(obj, name);
        if (array is null) return [];
        return array
            .Select(x => x?.ToString())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .ToArray();
    }

    public static IReadOnlyList<int> IntArray(string json)
    {
        return JsonSerializer.Deserialize<List<int>>(json, Options) ?? [];
    }

    public static IReadOnlyList<int> IntArray(JsonObject? obj, string name)
    {
        var array = ArrayProp(obj, name);
        if (array is null) return [];
        return array
            .Select(x => int.TryParse(x?.ToString(), out var parsed) ? parsed : (int?)null)
            .Where(x => x is not null)
            .Select(x => x!.Value)
            .ToArray();
    }

    public static string Serialize<T>(IEnumerable<T> values) => JsonSerializer.Serialize(values, Options);

    public static bool TextEquals(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return false;
        return string.Equals(Normalize(left), Normalize(right), StringComparison.OrdinalIgnoreCase);
    }

    public static bool TextContains(IReadOnlyCollection<string> candidates, string? value)
    {
        return candidates.Count == 0 ||
            candidates.Any(candidate => TextEquals(candidate, value));
    }

    private static string Normalize(string value)
    {
        return string.Concat(value.Trim().Normalize(NormalizationForm.FormC)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
            .Replace('أ', 'ا')
            .Replace('إ', 'ا')
            .Replace('آ', 'ا')
            .Replace('ى', 'ي')
            .Replace('ة', 'ه');
    }
}
