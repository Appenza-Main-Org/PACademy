using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/exam-schedule")]
public sealed class ExamScheduleController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet("cycles/{cycleId}")]
    public async Task<IActionResult> ListDays([FromRoute] string cycleId, [FromQuery] string? categoryId, CancellationToken ct)
        => Ok((await List(ct))
            .Where(x => ReadString(x, "cycleId") == cycleId && (categoryId is null || ReadString(x, "applicantCategoryId") == categoryId))
            .OrderBy(x => ReadString(x, "date"))
            .ToList());

    [HttpGet("cycles/{cycleId}/aggregate")]
    public async Task<IActionResult> Aggregate([FromRoute] string cycleId, CancellationToken ct)
    {
        var configs = await Bucket("applicantCategoryConfigs", ct);
        var activeCategoryIds = configs
            .Where(x => ReadBool(x, "isActive") != false)
            .OrderBy(x => ReadNumber(x, "sortOrder"))
            .Select(x => ReadString(x, "categoryId"))
            .Where(x => x is not null)
            .ToList();
        var days = (await List(ct)).Where(x => ReadString(x, "cycleId") == cycleId).ToList();
        return Ok(new { activeCategoryIds, days });
    }

    [HttpPost("cycles/{cycleId}/bulk")]
    public async Task<IActionResult> Bulk([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var categoryId = ReadString(body, "applicantCategoryId") ?? "";
        var startDate = ReadString(body, "startDate") ?? "";
        var endDate = ReadString(body, "endDate") ?? startDate;
        var note = ReadString(body, "note");
        var existing = (await List(ct)).Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "applicantCategoryId") == categoryId).Select(x => ReadString(x, "date")).ToHashSet();
        var created = new JsonArray();
        var skipped = new JsonArray();
        foreach (var date in DateRange(startDate, endDate))
        {
            if (existing.Contains(date))
            {
                skipped.Add(date);
                continue;
            }
            var row = Day(cycleId, categoryId, date, IsWeekend(date) ? "OFF" : "WORKING", note);
            await Upsert(ReadString(row, "id")!, row, ct);
            created.Add(row.DeepClone());
        }
        return Ok(new { created, skippedExistingDates = skipped });
    }

    [HttpPost("cycles/{cycleId}/days")]
    public async Task<IActionResult> AddDay([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var row = Day(cycleId, ReadString(body, "applicantCategoryId") ?? "", ReadString(body, "date") ?? "", ReadString(body, "kind") ?? "WORKING", ReadString(body, "note"));
        await Upsert(ReadString(row, "id")!, row, ct);
        return Ok(row);
    }

    [HttpPatch("days/{dayId}")]
    public async Task<IActionResult> PatchDay([FromRoute] string dayId, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var row = await Get(dayId, ct);
        if (row is null) return NotFound();
        Merge(row, patch);
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(dayId, row, ct);
        return Ok(row);
    }

    [HttpDelete("days/{dayId}")]
    public async Task<IActionResult> DeleteDay([FromRoute] string dayId, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == "examScheduleDays" && x.Id == dayId, ct);
        if (item is not null)
        {
            db.Items.Remove(item);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("days/{dayId}/toggle-off")]
    public async Task<IActionResult> Toggle([FromRoute] string dayId, CancellationToken ct)
    {
        var row = await Get(dayId, ct);
        if (row is null) return NotFound();
        row["kind"] = ReadString(row, "kind") == "WORKING" ? "OFF" : "WORKING";
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(dayId, row, ct);
        return Ok(row);
    }

    [HttpPost("cycles/{cycleId}/clear-range")]
    public async Task<IActionResult> Clear([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var categoryId = ReadString(body, "applicantCategoryId");
        var start = ReadString(body, "startDate") ?? "";
        var end = ReadString(body, "endDate") ?? start;
        var items = await db.Items.Where(x => x.Bucket == "examScheduleDays").ToListAsync(ct);
        var deleted = 0;
        foreach (var item in items)
        {
            var row = Parse(item.PayloadJson);
            var date = ReadString(row, "date") ?? "";
            if (ReadString(row, "cycleId") == cycleId && ReadString(row, "applicantCategoryId") == categoryId && string.CompareOrdinal(date, start) >= 0 && string.CompareOrdinal(date, end) <= 0)
            {
                db.Items.Remove(item);
                deleted++;
            }
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { deleted });
    }

    [HttpPost("cycles/{cycleId}/copy-from-category")]
    public async Task<IActionResult> Copy([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var source = ReadString(body, "sourceCategoryId");
        var target = ReadString(body, "targetCategoryId");
        var overwrite = ReadBool(body, "overwrite") ?? false;
        var days = await List(ct);
        var targetDates = days.Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "applicantCategoryId") == target).Select(x => ReadString(x, "date")).ToHashSet();
        var created = 0; var skipped = 0;
        foreach (var src in days.Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "applicantCategoryId") == source))
        {
            var date = ReadString(src, "date");
            if (targetDates.Contains(date) && !overwrite) { skipped++; continue; }
            var row = src.DeepClone().AsObject();
            row["id"] = $"ESD-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{created}";
            row["applicantCategoryId"] = target;
            await Upsert(ReadString(row, "id")!, row, ct);
            created++;
        }
        return Ok(new { created, skipped });
    }

    private async Task<List<JsonObject>> List(CancellationToken ct) => await Bucket("examScheduleDays", ct);
    private async Task<List<JsonObject>> Bucket(string bucket, CancellationToken ct)
        => (await db.Items.AsNoTracking().Where(x => x.Bucket == bucket).OrderBy(x => x.SortOrder).Select(x => x.PayloadJson).ToListAsync(ct)).Select(Parse).ToList();
    private async Task<JsonObject?> Get(string id, CancellationToken ct)
        => await db.Items.AsNoTracking().Where(x => x.Bucket == "examScheduleDays" && x.Id == id).Select(x => x.PayloadJson).FirstOrDefaultAsync(ct) is { } payload ? Parse(payload) : null;
    private async Task Upsert(string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == "examScheduleDays" && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == "examScheduleDays").Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create("examScheduleDays", id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else item.ReplacePayload(payload.ToJsonString(JsonOptions));
        await db.SaveChangesAsync(ct);
    }
    private static JsonObject Day(string cycleId, string categoryId, string date, string kind, string? note)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        return new JsonObject { ["id"] = $"ESD-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", ["cycleId"] = cycleId, ["applicantCategoryId"] = categoryId, ["date"] = date, ["kind"] = kind, ["note"] = note, ["createdAt"] = now, ["updatedAt"] = now };
    }
    private static IEnumerable<string> DateRange(string start, string end)
    {
        for (var d = DateOnly.Parse(start); d <= DateOnly.Parse(end); d = d.AddDays(1)) yield return d.ToString("yyyy-MM-dd");
    }
    private static bool IsWeekend(string date)
    {
        var day = DateOnly.Parse(date).DayOfWeek;
        return day is DayOfWeek.Friday or DayOfWeek.Saturday;
    }
    private static void Merge(JsonObject target, JsonObject patch) { foreach (var (key, value) in patch) target[key] = value?.DeepClone(); }
    private static JsonObject Parse(string payload) => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();
    private static string? ReadString(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;
    private static bool? ReadBool(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<bool>() : null;
    private static int ReadNumber(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) && value is not null ? value.GetValue<int>() : 0;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
