using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using PACademy.Shared.Contracts;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/cycles")]
public sealed class CyclesController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeDeleted = false, CancellationToken ct = default)
    {
        var rows = await ListObjects("cycles", ct);
        if (!includeDeleted)
        {
            rows = rows.Where(x => x["deletedAt"] is null).ToList();
        }

        return Ok(rows
            .OrderByDescending(x => ReadNumber(x, "year"))
            .ThenBy(x => ReadString(x, "id"))
            .ToList());
    }

    [HttpGet("active")]
    public async Task<IActionResult> Active(CancellationToken ct)
    {
        var activeId = await ActiveCycleId(ct);
        if (activeId is null) return Ok(null);
        var cycle = await GetObject("cycles", activeId, ct);
        return Ok(cycle);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get([FromRoute] string id, CancellationToken ct)
        => await GetObject("cycles", id, ct) is { } row ? Ok(row) : NotFound();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = ReadString(body, "id") ?? $"CYC-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        body["applicantCount"] ??= 0;
        body["createdAt"] ??= DateTimeOffset.UtcNow.ToString("O");
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");

        if (await db.Items.AnyAsync(x => x.Bucket == "cycles" && x.Id == id, ct))
        {
            return ConflictEnvelope(ErrorCodes.LookupCodeDuplicate, "يوجد دورة بنفس الكود.");
        }

        await AddObject("cycles", id, body, ct);
        if (ReadString(body, "status") == "active" || ReadBool(body, "isActive") == true)
        {
            await SetActiveCycleId(id, ct);
        }

        return CreatedAtAction(nameof(Get), new { id }, body);
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update([FromRoute] string id, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var current = await GetObject("cycles", id, ct);
        if (current is null) return NotFound();
        Merge(current, patch);
        current["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await ReplaceObject("cycles", id, current, ct);
        return Ok(current);
    }

    [HttpPost("{id}/clone")]
    public async Task<IActionResult> Clone([FromRoute] string id, CancellationToken ct)
    {
        var current = await GetObject("cycles", id, ct);
        if (current is null) return NotFound();

        var clone = current.DeepClone().AsObject();
        var nextId = $"{id}-COPY-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        clone["id"] = nextId;
        clone["nameAr"] = $"{ReadString(current, "nameAr")} (نسخة)";
        clone["status"] = "draft";
        clone["isActive"] = false;
        clone["applicantCount"] = 0;
        clone["createdAt"] = DateTimeOffset.UtcNow.ToString("O");
        clone["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await AddObject("cycles", nextId, clone, ct);
        return Ok(clone);
    }

    [HttpPost("{id}/transition")]
    public async Task<IActionResult> Transition([FromRoute] string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var next = ReadString(body, "status") ?? ReadString(body, "next") ?? "draft";
        return await SetStatus(id, next, next is "active" or "open", ct);
    }

    [HttpPost("{id}/activate")]
    public async Task<IActionResult> Activate([FromRoute] string id, CancellationToken ct)
        => await SetStatus(id, "active", true, ct);

    [HttpPost("{id}/close")]
    public async Task<IActionResult> Close([FromRoute] string id, CancellationToken ct)
        => await SetStatus(id, "closed", false, ct);

    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive([FromRoute] string id, CancellationToken ct)
        => await SetStatus(id, "archived", false, ct);

    [HttpPost("{id}/extend")]
    public async Task<IActionResult> Extend([FromRoute] string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var date = ReadString(body, "newCloseDate") ?? ReadString(body, "closeDate");
        if (string.IsNullOrWhiteSpace(date)) return Validation("newCloseDate", "تاريخ الإغلاق مطلوب.");
        return await Update(id, new JsonObject { ["closeDate"] = date, ["status"] = "extended" }, ct);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove([FromRoute] string id, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == "cycles" && x.Id == id, ct);
        if (item is not null)
        {
            db.Items.Remove(item);
            await db.SaveChangesAsync(ct);
        }
        return Ok(new { ok = true });
    }

    [HttpGet("{id}/dependencies")]
    public IActionResult Dependencies([FromRoute] string id)
        => Ok(new { canDelete = true, dependencies = Array.Empty<object>(), entityId = id });

    [HttpPost("{id}/soft-delete")]
    public async Task<IActionResult> SoftDelete([FromRoute] string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var reason = ReadString(body, "reason") ?? "soft delete";
        return await Update(id, new JsonObject
        {
            ["deletedAt"] = DateTimeOffset.UtcNow.ToString("O"),
            ["deletedReason"] = reason,
        }, ct);
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore([FromRoute] string id, CancellationToken ct)
        => await Update(id, new JsonObject { ["deletedAt"] = null, ["deletedReason"] = null }, ct);

    [HttpPatch("{id}/categories/{key}")]
    public async Task<IActionResult> ToggleCategory(
        [FromRoute] string id,
        [FromRoute] string key,
        [FromBody] JsonObject config,
        CancellationToken ct)
    {
        var current = await GetObject("cycles", id, ct);
        if (current is null) return NotFound();
        var openCategories = current["openCategories"] as JsonObject ?? new JsonObject();
        openCategories[key] = config.DeepClone();
        current["openCategories"] = openCategories;
        current["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await ReplaceObject("cycles", id, current, ct);
        return Ok(current);
    }

    [HttpPatch("{id}/categories/{key}/conditions")]
    public async Task<IActionResult> Conditions(
        [FromRoute] string id,
        [FromRoute] string key,
        [FromBody] JsonObject overrides,
        CancellationToken ct)
    {
        var current = await GetObject("cycles", id, ct);
        if (current is null) return NotFound();
        var conditionOverrides = current["conditionOverrides"] as JsonObject ?? new JsonObject();
        conditionOverrides[key] = overrides.DeepClone();
        current["conditionOverrides"] = conditionOverrides;
        current["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await ReplaceObject("cycles", id, current, ct);
        return Ok(current);
    }

    private async Task<IActionResult> SetStatus(string id, string status, bool makeActive, CancellationToken ct)
    {
        var current = await GetObject("cycles", id, ct);
        if (current is null) return NotFound();
        current["status"] = status;
        current["isActive"] = makeActive;
        current["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await ReplaceObject("cycles", id, current, ct);

        if (makeActive)
        {
            var all = await ListObjects("cycles", ct);
            foreach (var cycle in all.Where(x => ReadString(x, "id") != id))
            {
                cycle["isActive"] = false;
                if (ReadString(cycle, "status") is "active" or "open" or "extended") cycle["status"] = "closed";
                await ReplaceObject("cycles", ReadString(cycle, "id")!, cycle, ct);
            }
            await SetActiveCycleId(id, ct);
        }

        return Ok(current);
    }

    private async Task<string?> ActiveCycleId(CancellationToken ct)
    {
        var meta = await GetObject("meta", "activeCycleId", ct);
        return meta is null ? null : ReadString(meta, "value");
    }

    private async Task SetActiveCycleId(string id, CancellationToken ct)
    {
        var meta = new JsonObject { ["value"] = id };
        if (await GetObject("meta", "activeCycleId", ct) is null)
            await AddObject("meta", "activeCycleId", meta, ct);
        else
            await ReplaceObject("meta", "activeCycleId", meta, ct);
    }

    private async Task<List<JsonObject>> ListObjects(string bucket, CancellationToken ct)
        => (await db.Items.AsNoTracking()
            .Where(x => x.Bucket == bucket)
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task<JsonObject?> GetObject(string bucket, string id, CancellationToken ct)
        => await db.Items.AsNoTracking()
            .Where(x => x.Bucket == bucket && x.Id == id)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(ct) is { } payload ? Parse(payload) : null;

    private async Task AddObject(string bucket, string id, JsonObject payload, CancellationToken ct)
    {
        var max = await db.Items.Where(x => x.Bucket == bucket).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
        db.Items.Add(AdminJsonItem.Create(bucket, id, payload.ToJsonString(JsonOptions), max + 1));
        await db.SaveChangesAsync(ct);
    }

    private async Task ReplaceObject(string bucket, string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstAsync(x => x.Bucket == bucket && x.Id == id, ct);
        item.ReplacePayload(payload.ToJsonString(JsonOptions));
        await db.SaveChangesAsync(ct);
    }

    private IActionResult ConflictEnvelope(string conflictCode, string message)
        => Conflict(new { code = ErrorCodes.Conflict, conflictCode, message });

    private IActionResult Validation(string field, string message)
        => BadRequest(new { code = ErrorCodes.ValidationFailed, errors = new Dictionary<string, string> { [field] = message }, message });

    private static void Merge(JsonObject target, JsonObject patch)
    {
        foreach (var (key, value) in patch) target[key] = value?.DeepClone();
    }

    private static JsonObject Parse(string payload)
        => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();

    private static string? ReadString(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;

    private static bool? ReadBool(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<bool>() : null;

    private static int ReadNumber(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) && value is not null ? value.GetValue<int>() : 0;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
