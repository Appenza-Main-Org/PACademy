using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.AdminRecords;

public static class AdminRecordJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static JsonObject Parse(string json) => JsonNode.Parse(json)?.AsObject() ?? [];
    public static JsonObject Clone(JsonObject value) => JsonNode.Parse(value.ToJsonString(Options))?.AsObject() ?? [];
    public static string? StringProp(JsonObject obj, string name) => obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;
    public static double? NumberProp(JsonObject obj, string name) => obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<double>() : null;
}
