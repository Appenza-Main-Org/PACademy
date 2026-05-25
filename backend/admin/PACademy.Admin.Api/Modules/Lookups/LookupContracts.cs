using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed record LookupMeta(string Label, string CodePrefix, int Padding);

public static class LookupCatalog
{
    public static readonly IReadOnlyList<string> Keys =
    [
        "relationships",
        "relationship-degree-tiers",
        "faculties",
        "specializations",
        "tests",
        "test-results",
        "committees",
        "submission-types",
        "applicant-categories",
        "nationalities-countries",
        "governorates",
        "police-stations",
        "jobs",
        "qualifications",
        "announcements",
        "applicant-divisions",
        "school-categories",
        "nid-missing-reasons",
        "universities",
        "marital-statuses",
        "academic-grades",
        "academic-degrees",
        "exam-rounds",
        "graduation-years",
        "excellence-criteria"
    ];

    public static readonly IReadOnlyDictionary<string, LookupMeta> Meta = new Dictionary<string, LookupMeta>
    {
        ["relationships"] = new("صلات القرابة", "REL", 3),
        ["relationship-degree-tiers"] = new("فئات درجات القرابة", "RDT", 1),
        ["tests"] = new("الاختبارات والقبول", "TST", 2),
        ["test-results"] = new("نتائج الاختبارات", "RES", 2),
        ["committees"] = new("اللجان", "CMT", 2),
        ["specializations"] = new("التخصصات", "SPC", 2),
        ["faculties"] = new("الكليات", "FAC", 2),
        ["submission-types"] = new("نوع التقديم", "SUB", 2),
        ["applicant-categories"] = new("فئات المتقدمين", "CAT", 2),
        ["nationalities-countries"] = new("الجنسيات والدول", "CNT", 3),
        ["governorates"] = new("المحافظات", "GOV", 2),
        ["police-stations"] = new("أقسام ومراكز الشرطة", "PST", 4),
        ["jobs"] = new("الوظائف وفئاتها", "JOB", 3),
        ["qualifications"] = new("المؤهلات", "QUA", 2),
        ["announcements"] = new("التنبيهات العامة للتقدم", "ANN", 2),
        ["applicant-divisions"] = new("شعبة المتقدمين", "DIV", 2),
        ["school-categories"] = new("فئة المدرسة", "SCH", 2),
        ["nid-missing-reasons"] = new("أسباب تعذر وجود رقم قومي", "NMR", 2),
        ["universities"] = new("الجامعات", "UNI", 2),
        ["marital-statuses"] = new("الحالة الاجتماعية", "MAR", 2),
        ["academic-grades"] = new("التقدير الأكاديمي", "AGR", 2),
        ["academic-degrees"] = new("الدرجة العلمية", "DEG", 2),
        ["exam-rounds"] = new("دور الامتحان", "ROUND", 2),
        ["graduation-years"] = new("سنوات التخرج", "GYR", 4),
        ["excellence-criteria"] = new("معيار التمييز", "EXC", 2)
    };

    public static bool IsKnown(string key) => Meta.ContainsKey(key);
}

public sealed record DeleteLookupRowResult(bool Deleted, string? Reason = null, int? ReferenceCount = null);

public static class LookupJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    public static JsonObject ParseObject(string json)
    {
        return JsonNode.Parse(json)?.AsObject() ?? [];
    }

    public static JsonObject Clone(JsonObject value)
    {
        return JsonNode.Parse(value.ToJsonString(Options))?.AsObject() ?? [];
    }

    public static string? StringProp(JsonObject obj, string name)
    {
        return obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;
    }

    public static bool? BoolProp(JsonObject obj, string name)
    {
        return obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<bool>() : null;
    }

    public static int? IntProp(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<int>();
        }
        catch (InvalidOperationException)
        {
            return int.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }
}
