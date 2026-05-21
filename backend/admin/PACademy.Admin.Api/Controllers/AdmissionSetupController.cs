using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
public sealed class AdmissionSetupController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public async Task<IActionResult> GetExamDates([FromRoute] string cycleId, CancellationToken ct)
        => Ok((await List("examDateConfigs", ct)).FirstOrDefault(x => ReadString(x, "cycleId") == cycleId));

    [HttpPut("api/admission-setup/cycles/{cycleId}/exam-dates")]
    public async Task<IActionResult> SetExamDates([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var current = (await List("examDateConfigs", ct)).FirstOrDefault(x => ReadString(x, "cycleId") == cycleId);
        var id = ReadString(current ?? body, "id") ?? $"EDC-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        body["cycleId"] = cycleId;
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        body["updatedBy"] ??= "system";
        await Upsert("examDateConfigs", id, body, ct);
        return Ok(body);
    }

    [HttpGet("api/admission-setup/cycles/{cycleId}/declaration")]
    public async Task<IActionResult> GetDeclaration([FromRoute] string cycleId, CancellationToken ct)
        => Ok((await List("declarations", ct))
            .Where(x => ReadString(x, "cycleId") == cycleId && x["deletedAt"] is null)
            .OrderByDescending(x => ReadNumber(x, "version"))
            .FirstOrDefault());

    [HttpPut("api/admission-setup/cycles/{cycleId}/declaration")]
    public async Task<IActionResult> SetDeclaration([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var previous = (await List("declarations", ct))
            .Where(x => ReadString(x, "cycleId") == cycleId)
            .OrderByDescending(x => ReadNumber(x, "version"))
            .FirstOrDefault();
        var version = (previous is null ? 0 : ReadNumber(previous, "version")) + 1;
        var id = $"DEC-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        body["cycleId"] = cycleId;
        body["version"] = version;
        body["createdAt"] = DateTimeOffset.UtcNow.ToString("O");
        body["createdBy"] ??= "system";
        await Upsert("declarations", id, body, ct);
        return Ok(body);
    }

    [HttpPost("api/admission-setup/declarations/{id}/publish")]
    public async Task<IActionResult> PublishDeclaration([FromRoute] string id, CancellationToken ct)
    {
        var row = await Get("declarations", id, ct);
        if (row is null) return NotFound();
        row["publishedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert("declarations", id, row, ct);
        return Ok(row);
    }

    [HttpGet("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public async Task<IActionResult> CommitteeBindings([FromRoute] string cycleId, [FromQuery] string? categoryId, CancellationToken ct)
        => Ok((await List("categoryCommittees", ct))
            .Where(x => ReadString(x, "cycleId") == cycleId && (categoryId is null || ReadString(x, "categoryId") == categoryId))
            .ToList());

    [HttpPut("api/admission-setup/cycles/{cycleId}/committee-bindings")]
    public async Task<IActionResult> SetCommitteeBindings([FromRoute] string cycleId, [FromBody] JsonObject body, CancellationToken ct)
        => Ok(await ReplaceCommitteeBindings(cycleId, body, null, ct));

    [HttpPut("api/admission-setup/cycles/{cycleId}/categories/{categoryId}/committees")]
    public async Task<IActionResult> SetCategoryCommittees(
        [FromRoute] string cycleId,
        [FromRoute] string categoryId,
        [FromBody] JsonObject body,
        CancellationToken ct)
        => Ok(await ReplaceCommitteeBindings(cycleId, body, categoryId, ct));

    private async Task<List<JsonObject>> ReplaceCommitteeBindings(string cycleId, JsonObject body, string? categoryScope, CancellationToken ct)
    {
        var committeeIds = body["committeeIds"]?.AsArray().Select(x => x?.GetValue<string>()).Where(x => x is not null).Cast<string>().Distinct().ToList() ?? [];
        var academicYearId = ReadString(body, "academicYearId") ?? "2026-2027";
        var categoryId = categoryScope ?? ReadString(body, "categoryId") ?? "officers_general";
        var existing = await db.Items.Where(x => x.Bucket == "categoryCommittees").ToListAsync(ct);
        foreach (var item in existing)
        {
            var obj = Parse(item.PayloadJson);
            if (ReadString(obj, "cycleId") == cycleId && (categoryScope is null || ReadString(obj, "categoryId") == categoryScope))
            {
                db.Items.Remove(item);
            }
        }
        await db.SaveChangesAsync(ct);

        var now = DateTimeOffset.UtcNow.ToString("O");
        var rows = new List<JsonObject>();
        var order = 1;
        foreach (var committeeId in committeeIds)
        {
            var id = $"CC-{cycleId}-{categoryId}-{committeeId}";
            var row = new JsonObject
            {
                ["id"] = id,
                ["categoryId"] = categoryId,
                ["committeeId"] = committeeId,
                ["academicYearId"] = academicYearId,
                ["cycleId"] = cycleId,
                ["order"] = order++,
                ["createdAt"] = now,
                ["createdBy"] = ReadString(body, "actorUserId") ?? "system",
            };
            await Upsert("categoryCommittees", id, row, ct);
            rows.Add(row);
        }
        return rows;
    }

    private async Task<List<JsonObject>> List(string bucket, CancellationToken ct)
        => (await db.Items.AsNoTracking()
            .Where(x => x.Bucket == bucket)
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task<JsonObject?> Get(string bucket, string id, CancellationToken ct)
        => await db.Items.AsNoTracking().Where(x => x.Bucket == bucket && x.Id == id).Select(x => x.PayloadJson).FirstOrDefaultAsync(ct) is { } payload
            ? Parse(payload)
            : null;

    private async Task Upsert(string bucket, string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == bucket && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == bucket).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create(bucket, id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else
        {
            item.ReplacePayload(payload.ToJsonString(JsonOptions));
        }
        await db.SaveChangesAsync(ct);
    }

    private static JsonObject Parse(string payload)
        => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();

    private static string? ReadString(JsonObject? obj, string property)
        => obj is not null && obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;

    private static int ReadNumber(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) && value is not null ? value.GetValue<int>() : 0;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
