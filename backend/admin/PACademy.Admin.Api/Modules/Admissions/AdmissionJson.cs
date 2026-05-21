using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.Admissions;

public static class AdmissionJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static JsonObject Parse(string json) => JsonNode.Parse(json)?.AsObject() ?? [];
    public static JsonObject Clone(JsonObject value) => JsonNode.Parse(value.ToJsonString(Options))?.AsObject() ?? [];
    public static string? StringProp(JsonObject obj, string name) => obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;
    public static bool? BoolProp(JsonObject obj, string name) => obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<bool>() : null;
    public static int? IntProp(JsonObject obj, string name) => obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<int>() : null;
}
