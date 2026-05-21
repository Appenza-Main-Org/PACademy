using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/committee-bindings")]
public sealed class CommitteeBindingsController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet("cycles/{cycleId}")]
    public async Task<IActionResult> List(
        [FromRoute] string cycleId,
        [FromQuery] string? categoryId,
        [FromQuery] string? committeeId,
        [FromQuery] string? dayId,
        [FromQuery] bool onlyActive = false,
        CancellationToken ct = default)
        => Ok((await Bucket(ct))
            .Where(x => ReadString(x, "cycleId") == cycleId)
            .Where(x => categoryId is null || ReadString(x, "applicantCategoryId") == categoryId)
            .Where(x => committeeId is null || ReadString(x, "committeeId") == committeeId)
            .Where(x => dayId is null || ReadString(x, "examScheduleDayId") == dayId)
            .Where(x => !onlyActive || ReadBool(x, "isActive") != false)
            .OrderBy(x => ReadString(x, "id"))
            .ToList());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = ReadString(body, "id") ?? $"CDB-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        body["isActive"] ??= true;
        body["createdAt"] ??= DateTimeOffset.UtcNow.ToString("O");
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(id, body, ct);
        return Ok(body);
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Patch([FromRoute] string id, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var row = await Get(id, ct);
        if (row is null) return NotFound();
        Merge(row, patch);
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(id, row, ct);
        return Ok(row);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete([FromRoute] string id, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == "committeeDayBindings" && x.Id == id, ct);
        if (item is not null)
        {
            db.Items.Remove(item);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("{id}/toggle-active")]
    public async Task<IActionResult> Toggle([FromRoute] string id, CancellationToken ct)
    {
        var row = await Get(id, ct);
        if (row is null) return NotFound();
        row["isActive"] = !(ReadBool(row, "isActive") ?? true);
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(id, row, ct);
        return Ok(row);
    }

    [HttpPost("bulk-eligibility")]
    public async Task<IActionResult> BulkEligibility([FromBody] JsonObject body, CancellationToken ct)
    {
        var cycleId = ReadString(body, "cycleId") ?? "";
        var categoryId = ReadString(body, "applicantCategoryId") ?? "";
        var overwrite = ReadBool(body, "overwrite") ?? false;
        var capacity = ReadNumber(body, "capacity");
        var eligibility = body["eligibility"]?.DeepClone();
        var targets = body["targets"]?.AsArray().OfType<JsonObject>().ToList() ?? [];
        var existing = await Bucket(ct);
        var updated = 0;
        var created = 0;
        var skipped = 0;

        foreach (var target in targets)
        {
            var committeeId = ReadString(target, "committeeId") ?? "";
            var dayId = ReadString(target, "examScheduleDayId") ?? "";
            if (committeeId == "*" || dayId == "*")
            {
                skipped++;
                continue;
            }

            var row = existing.FirstOrDefault(x =>
                ReadString(x, "cycleId") == cycleId &&
                ReadString(x, "committeeId") == committeeId &&
                ReadString(x, "examScheduleDayId") == dayId);

            if (row is not null)
            {
                if (!overwrite)
                {
                    skipped++;
                    continue;
                }
                if (eligibility is not null) row["eligibility"] = eligibility.DeepClone();
                if (capacity is not null) row["capacity"] = capacity;
                row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
                await Upsert(ReadString(row, "id")!, row, ct);
                updated++;
                continue;
            }

            var id = $"CDB-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{created}";
            var now = DateTimeOffset.UtcNow.ToString("O");
            var next = new JsonObject
            {
                ["id"] = id,
                ["cycleId"] = cycleId,
                ["applicantCategoryId"] = categoryId,
                ["committeeId"] = committeeId,
                ["examScheduleDayId"] = dayId,
                ["capacity"] = capacity ?? 1,
                ["eligibility"] = eligibility?.DeepClone(),
                ["isActive"] = true,
                ["note"] = null,
                ["createdAt"] = now,
                ["updatedAt"] = now,
            };
            await Upsert(id, next, ct);
            created++;
        }

        return Ok(new { updated, created, skipped });
    }

    [HttpPost("copy-row")]
    public async Task<IActionResult> CopyRow([FromBody] JsonObject body, CancellationToken ct)
        => Ok(await Copy(body, "committeeId", ReadString(body, "sourceCommitteeId"), ReadString(body, "targetCommitteeId"), ct));

    [HttpPost("copy-column")]
    public async Task<IActionResult> CopyColumn([FromBody] JsonObject body, CancellationToken ct)
        => Ok(await Copy(body, "examScheduleDayId", ReadString(body, "sourceDayId"), ReadString(body, "targetDayId"), ct));

    private async Task<object> Copy(JsonObject body, string axis, string? source, string? target, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(target) || source == target)
            return new { created = 0, updated = 0, skipped = 0 };

        var cycleId = ReadString(body, "cycleId");
        var categoryId = ReadString(body, "applicantCategoryId");
        var overwrite = ReadBool(body, "overwrite") ?? false;
        var rows = await Bucket(ct);
        var sourceRows = rows
            .Where(x => ReadString(x, "cycleId") == cycleId)
            .Where(x => ReadString(x, "applicantCategoryId") == categoryId)
            .Where(x => ReadString(x, axis) == source)
            .ToList();
        var created = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var src in sourceRows)
        {
            var dayId = axis == "examScheduleDayId" ? target : ReadString(src, "examScheduleDayId");
            var committeeId = axis == "committeeId" ? target : ReadString(src, "committeeId");
            var existing = rows.FirstOrDefault(x =>
                ReadString(x, "cycleId") == cycleId &&
                ReadString(x, "committeeId") == committeeId &&
                ReadString(x, "examScheduleDayId") == dayId);
            if (existing is not null)
            {
                if (!overwrite)
                {
                    skipped++;
                    continue;
                }
                existing["capacity"] = src["capacity"]?.DeepClone();
                existing["eligibility"] = src["eligibility"]?.DeepClone();
                existing["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
                await Upsert(ReadString(existing, "id")!, existing, ct);
                updated++;
                continue;
            }

            var clone = src.DeepClone().AsObject();
            var id = $"CDB-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{created}";
            clone["id"] = id;
            clone["committeeId"] = committeeId;
            clone["examScheduleDayId"] = dayId;
            clone["createdAt"] = DateTimeOffset.UtcNow.ToString("O");
            clone["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await Upsert(id, clone, ct);
            created++;
        }

        return new { created, updated, skipped };
    }

    private async Task<List<JsonObject>> Bucket(CancellationToken ct)
        => (await db.Items.AsNoTracking()
            .Where(x => x.Bucket == "committeeDayBindings")
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task<JsonObject?> Get(string id, CancellationToken ct)
        => await db.Items.AsNoTracking()
            .Where(x => x.Bucket == "committeeDayBindings" && x.Id == id)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(ct) is { } payload ? Parse(payload) : null;

    private async Task Upsert(string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == "committeeDayBindings" && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == "committeeDayBindings").Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create("committeeDayBindings", id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else
        {
            item.ReplacePayload(payload.ToJsonString(JsonOptions));
        }
        await db.SaveChangesAsync(ct);
    }

    private static void Merge(JsonObject target, JsonObject patch)
    {
        foreach (var (key, value) in patch) target[key] = value?.DeepClone();
    }

    private static JsonObject Parse(string payload) => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();
    private static string? ReadString(JsonObject? obj, string property) => obj is not null && obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;
    private static bool? ReadBool(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<bool>() : null;
    private static int? ReadNumber(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) && value is not null ? value.GetValue<int>() : null;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
