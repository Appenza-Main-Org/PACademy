using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public static class AdminRecordJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static JsonObject Parse(string json) => JsonNode.Parse(json)?.AsObject() ?? [];
    public static JsonObject Clone(JsonObject value) => JsonNode.Parse(value.ToJsonString(Options))?.AsObject() ?? [];
    public static string? StringProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<string>();
        }
        catch (InvalidOperationException)
        {
            return node.ToString();
        }
    }
    public static double? NumberProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<double>();
        }
        catch (InvalidOperationException)
        {
            try
            {
                return node.GetValue<long>();
            }
            catch (InvalidOperationException)
            {
                return double.TryParse(node.ToString(), out var parsed) ? parsed : null;
            }
        }
    }

    /// True when the payload carries a non-null `deletedAt` tombstone.
    public static bool IsSoftDeleted(JsonObject obj) =>
        obj.TryGetPropertyValue("deletedAt", out var node) && node is not null
        && !string.IsNullOrWhiteSpace(node.ToString());
}
