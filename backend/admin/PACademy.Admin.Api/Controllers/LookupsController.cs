using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.LookupsAdmin.Infrastructure;
using PACademy.Shared.Contracts;
using PACademy.Shared.Domain.Lookups;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/lookups/{key}")]
public sealed class LookupsController(LookupsAdminDbContext db) : ControllerBase
{
    private static readonly string[] LookupKeys =
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
        "excellence-criteria",
    ];

    private static readonly HashSet<string> LookupKeySet = new(LookupKeys, StringComparer.Ordinal);

    private static readonly Dictionary<string, (string Prefix, int Padding)> CodeRules = new(StringComparer.Ordinal)
    {
        ["relationships"] = ("REL", 3),
        ["relationship-degree-tiers"] = ("RDT", 1),
        ["tests"] = ("TST", 2),
        ["test-results"] = ("RES", 2),
        ["committees"] = ("CMT", 2),
        ["specializations"] = ("SPC", 2),
        ["faculties"] = ("FAC", 2),
        ["submission-types"] = ("SUB", 2),
        ["applicant-categories"] = ("CAT", 2),
        ["nationalities-countries"] = ("CNT", 3),
        ["governorates"] = ("GOV", 2),
        ["police-stations"] = ("PST", 4),
        ["jobs"] = ("JOB", 3),
        ["qualifications"] = ("QUA", 2),
        ["announcements"] = ("ANN", 2),
        ["applicant-divisions"] = ("DIV", 2),
        ["school-categories"] = ("SCH", 2),
        ["nid-missing-reasons"] = ("NMR", 2),
        ["universities"] = ("UNI", 2),
        ["marital-statuses"] = ("MAR", 2),
        ["academic-grades"] = ("AGR", 2),
        ["academic-degrees"] = ("DEG", 2),
        ["exam-rounds"] = ("ROUND", 2),
        ["graduation-years"] = ("GYR", 4),
        ["excellence-criteria"] = ("EXC", 2),
    };

    [HttpGet]
    public async Task<IActionResult> List([FromRoute] string key, CancellationToken ct)
    {
        if (!IsKnownLookup(key)) return UnknownLookup(key);

        var rows = await db.LookupItems
            .AsNoTracking()
            .Where(x => x.LookupKey == key)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Code)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct);

        return Ok(rows.Select(ParsePayload).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] string key, [FromBody] JsonObject body, CancellationToken ct)
    {
        if (!IsKnownLookup(key)) return UnknownLookup(key);

        var code = ReadString(body, "code");
        if (string.IsNullOrWhiteSpace(code))
        {
            code = await NextCodeAsync(key, ct);
            body["code"] = code;
        }

        if (await db.LookupItems.AnyAsync(x => x.LookupKey == key && x.Code == code, ct))
        {
            return DuplicateCode(code);
        }

        var name = ReadString(body, "name");
        if (string.IsNullOrWhiteSpace(name))
        {
            return Validation("name", "اسم الصف مطلوب.");
        }

        var isActive = ReadBool(body, "isActive") ?? true;
        body["isActive"] = isActive;
        var sortOrder = await db.LookupItems
            .Where(x => x.LookupKey == key)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(ct) ?? -1;

        var item = LookupItem.Create(key, code, name, isActive, body.ToJsonString(JsonOptions), sortOrder + 1);
        db.LookupItems.Add(item);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(List), new { key }, ParsePayload(item.PayloadJson));
    }

    [HttpPatch("{code}")]
    public async Task<IActionResult> Update(
        [FromRoute] string key,
        [FromRoute] string code,
        [FromBody] JsonObject patch,
        CancellationToken ct)
    {
        if (!IsKnownLookup(key)) return UnknownLookup(key);

        var current = await db.LookupItems.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct);
        if (current is null) return NotFound();

        var payload = ParsePayload(current.PayloadJson);
        foreach (var (property, value) in patch)
        {
            payload[property] = value?.DeepClone();
        }

        var nextCode = ReadString(payload, "code") ?? code;
        var name = ReadString(payload, "name");
        if (string.IsNullOrWhiteSpace(name))
        {
            return Validation("name", "اسم الصف مطلوب.");
        }

        if (!StringComparer.Ordinal.Equals(nextCode, code))
        {
            if (await db.LookupItems.AnyAsync(x => x.LookupKey == key && x.Code == nextCode, ct))
            {
                return DuplicateCode(nextCode);
            }

            db.LookupItems.Remove(current);
            db.LookupItems.Add(LookupItem.Create(
                key,
                nextCode,
                name,
                ReadBool(payload, "isActive") ?? true,
                payload.ToJsonString(JsonOptions),
                current.SortOrder));
        }
        else
        {
            current.ReplacePayload(
                nextCode,
                name,
                ReadBool(payload, "isActive") ?? true,
                payload.ToJsonString(JsonOptions));
        }

        await db.SaveChangesAsync(ct);
        return Ok(payload);
    }

    [HttpDelete("{code}")]
    public async Task<IActionResult> Delete([FromRoute] string key, [FromRoute] string code, CancellationToken ct)
    {
        if (!IsKnownLookup(key)) return UnknownLookup(key);

        var current = await db.LookupItems.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct);
        if (current is null) return Ok(new { deleted = true });

        var reference = await CountReferencesAsync(key, code, ct);
        if (reference.Count > 0)
        {
            return Conflict(new
            {
                deleted = false,
                reason = reference.Reason,
                referenceCount = reference.Count,
            });
        }

        db.LookupItems.Remove(current);
        await db.SaveChangesAsync(ct);
        return Ok(new { deleted = true });
    }

    private static bool IsKnownLookup(string key)
        => LookupKeySet.Contains(key);

    private IActionResult UnknownLookup(string key)
        => NotFound(new
        {
            code = ErrorCodes.LookupKeyUnknown,
            message = $"Unknown lookup key '{key}'.",
        });

    private IActionResult DuplicateCode(string code)
        => Conflict(new
        {
            code = ErrorCodes.Conflict,
            conflictCode = ErrorCodes.LookupCodeDuplicate,
            message = "الكود مستخدم مسبقاً.",
            detail = code,
        });

    private IActionResult Validation(string field, string message)
        => BadRequest(new
        {
            code = ErrorCodes.ValidationFailed,
            errors = new Dictionary<string, string> { [field] = message },
            message,
        });

    private async Task<string> NextCodeAsync(string key, CancellationToken ct)
    {
        var (prefix, padding) = CodeRules[key];
        var codes = await db.LookupItems
            .AsNoTracking()
            .Where(x => x.LookupKey == key)
            .Select(x => x.Code)
            .ToListAsync(ct);

        var max = 0;
        foreach (var code in codes)
        {
            var idx = code.LastIndexOf("-", StringComparison.Ordinal);
            if (idx < 0 || idx == code.Length - 1) continue;
            if (int.TryParse(code[(idx + 1)..], out var n) && n > max) max = n;
        }

        return $"{prefix}-{(max + 1).ToString().PadLeft(padding, '0')}";
    }

    private async Task<(int Count, string Reason)> CountReferencesAsync(string key, string code, CancellationToken ct)
    {
        var count = 0;
        var reasons = new List<string>();

        async Task CountInAsync(string lookupKey, string property, string reason)
        {
            var rows = await db.LookupItems
                .AsNoTracking()
                .Where(x => x.LookupKey == lookupKey)
                .Select(x => x.PayloadJson)
                .ToListAsync(ct);
            var refs = rows.Count(payload => StringComparer.Ordinal.Equals(ReadString(ParsePayload(payload), property), code));
            if (refs > 0)
            {
                count += refs;
                reasons.Add($"{refs} {reason}");
            }
        }

        async Task CountInMetadataAsync(string lookupKey, string property, string reason)
        {
            var rows = await db.LookupItems
                .AsNoTracking()
                .Where(x => x.LookupKey == lookupKey)
                .Select(x => x.PayloadJson)
                .ToListAsync(ct);
            var refs = rows.Count(payload =>
            {
                var metadata = ParsePayload(payload)["metadata"] as JsonObject;
                return metadata is not null && StringComparer.Ordinal.Equals(ReadString(metadata, property), code);
            });
            if (refs > 0)
            {
                count += refs;
                reasons.Add($"{refs} {reason}");
            }
        }

        if (key is "relationships" or "jobs")
        {
            await CountInAsync(key, "parentCode", key == "relationships" ? "صلة قرابة مرتبطة كفرع" : "وظيفة مرتبطة بهذه الفئة");
        }

        if (key == "governorates") await CountInAsync("police-stations", "governorateCode", "قسم/مركز شرطة في هذه المحافظة");
        if (key == "faculties") await CountInAsync("specializations", "facultyCode", "تخصص مرتبط بهذه الكلية");
        if (key == "applicant-categories") await CountInAsync("announcements", "categoryCode", "تنبيه مرتبط بهذه الفئة");
        if (key == "submission-types") await CountInMetadataAsync("applicant-categories", "submissionTypeCode", "فئة متقدمين مرتبطة بنوع التقديم هذا");
        if (key == "applicant-divisions") await CountInAsync("announcements", "divisionCode", "تنبيه مرتبط بهذه الشعبة");

        return (
            count,
            count > 0
                ? $"لا يمكن حذف هذا الكود — مستخدم في {count} سجل آخر ({string.Join("، ", reasons)})."
                : string.Empty);
    }

    private static JsonObject ParsePayload(string payload)
        => JsonNode.Parse(payload, documentOptions: default, nodeOptions: default)?.AsObject()
            ?? throw new JsonException("Lookup payload must be a JSON object.");

    private static string? ReadString(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;

    private static bool? ReadBool(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<bool>() : null;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };
}
