using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class GradesController(AdminRecordsService records) : ControllerBase
{
    [HttpGet("api/grades")]
    public async Task<ActionResult<object>> List([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] int? size, CancellationToken ct)
    {
        var rows = await FilterRows(ct);
        if (page is not null || pageSize is not null || size is not null)
        {
            var p = page.GetValueOrDefault(1);
            var ps = pageSize ?? size ?? 25;
            return Ok(new
            {
                rows = rows.Skip(Math.Max(0, p - 1) * ps).Take(ps).ToList(),
                total = rows.Count
            });
        }
        return Ok(rows);
    }

    [HttpGet("api/grades/export")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Export(CancellationToken ct) => Ok(await FilterRows(ct));

    [HttpGet("api/admin/applicant-grades/by-nid/{nid}")]
    public async Task<ActionResult<JsonObject>> ByNationalId(string nid, CancellationToken ct)
    {
        var row = (await records.ListAsync("grades", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "nid") == nid);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("api/grades")]
    public async Task<ActionResult<object>> Delete([FromBody] JsonObject? body, CancellationToken ct)
    {
        var rows = await records.ListAsync("grades", ct);
        var seats = body?["seats"]?.AsArray().Select(x => x?.GetValue<int>()).Where(x => x is not null).Select(x => x!.Value).ToHashSet();
        var targets = seats is { Count: > 0 }
            ? rows.Where(x => seats.Contains((int)(AdminRecordJson.NumberProp(x, "seat") ?? -1))).ToList()
            : rows;
        foreach (var row in targets)
        {
            var id = AdminRecordJson.StringProp(row, "id") ?? AdminRecordJson.StringProp(row, "seat") ?? "";
            if (!string.IsNullOrWhiteSpace(id)) await records.DeleteAsync("grades", id, ct);
        }
        return Ok(new { deleted = targets.Count });
    }

    [HttpPost("api/grades/import/stage")]
    public async Task<ActionResult<object>> StageImport([FromBody] JsonObject body, CancellationToken ct)
    {
        var rows = body["rows"]?.AsArray() ?? [];
        var existing = await records.ListAsync("grades", ct);
        var existingNids = existing.Select(x => AdminRecordJson.StringProp(x, "nid")).Where(x => x is not null).ToHashSet();
        var duplicates = new JsonArray();
        var newRows = 0;
        foreach (var node in rows.OfType<JsonObject>())
        {
            var nid = AdminRecordJson.StringProp(node, "nid") ?? AdminRecordJson.StringProp(node, "nationalId");
            if (!string.IsNullOrWhiteSpace(nid) && existingNids.Contains(nid)) duplicates.Add(new JsonObject { ["nationalId"] = nid });
            else newRows++;
        }
        return Ok(new { ok = true, staged = new { newRows, duplicates, skipped = Array.Empty<object>() } });
    }

    [HttpPost("api/grades/import/commit")]
    public async Task<ActionResult<object>> CommitImport([FromBody] JsonObject body, CancellationToken ct)
    {
        var inputRows = body["rows"]?.AsArray() ?? [];
        var graduationYear = body["graduationYear"]?.GetValue<int?>() ?? DateTimeOffset.UtcNow.Year;
        var existing = await records.ListAsync("grades", ct);
        var existingByNid = existing
            .Select(x => new { Nid = AdminRecordJson.StringProp(x, "nid"), Row = x })
            .Where(x => !string.IsNullOrWhiteSpace(x.Nid))
            .ToDictionary(x => x.Nid!, x => x.Row);
        var inserted = 0;
        var replaced = 0;
        var kept = 0;
        var skipped = new JsonArray();
        var nextSeat = existing.Select(x => (int)(AdminRecordJson.NumberProp(x, "seat") ?? 0)).DefaultIfEmpty(0).Max() + 1;

        foreach (var row in inputRows.OfType<JsonObject>())
        {
            var nid = AdminRecordJson.StringProp(row, "nationalId") ?? AdminRecordJson.StringProp(row, "nid");
            var name = AdminRecordJson.StringProp(row, "nameAr") ?? AdminRecordJson.StringProp(row, "name");
            var total = row["totalGrade"]?.GetValue<double?>() ?? row["total"]?.GetValue<double?>();
            if (string.IsNullOrWhiteSpace(nid) || string.IsNullOrWhiteSpace(name) || total is null)
            {
                skipped.Add(new JsonObject { ["nationalId"] = nid, ["reason"] = "MISSING_REQUIRED" });
                continue;
            }

            if (existingByNid.TryGetValue(nid, out var previous))
            {
                var action = AdminRecordJson.StringProp(row, "duplicateAction") ?? AdminRecordJson.StringProp(body, "duplicateAction") ?? "keep";
                if (action == "replace")
                {
                    var previousSeat = (int)(AdminRecordJson.NumberProp(previous, "seat") ?? nextSeat++);
                    var grade = GradeFromImportRow(row, previousSeat, nid, name, total.Value, graduationYear);
                    grade["previousGrade"] = previous["total"]?.DeepClone();
                    await records.UpsertAsync("grades", previousSeat.ToString(), grade, ct);
                    replaced++;
                }
                else
                {
                    kept++;
                }
                continue;
            }

            var seat = nextSeat++;
            await records.UpsertAsync("grades", seat.ToString(), GradeFromImportRow(row, seat, nid, name, total.Value, graduationYear), ct);
            inserted++;
        }

        return Ok(new { inserted, replaced, kept, deactivated = Array.Empty<object>(), skipped });
    }

    [HttpPost("api/grades/v2/preflight")]
    public ActionResult<object> Preflight([FromBody] JsonObject body)
    {
        var inputRows = body["rows"]?.AsArray() ?? [];
        var failures = new List<JsonObject>();
        foreach (var row in inputRows.OfType<JsonObject>())
        {
            var missing = string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "nationalId")) ||
                          string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "nameAr")) ||
                          row["totalGrade"] is null;
            if (missing)
            {
                failures.Add(new JsonObject
                {
                    ["nationalId"] = row["nationalId"]?.DeepClone(),
                    ["seatingNumber"] = row["seatingNumber"]?.DeepClone(),
                    ["nameAr"] = row["nameAr"]?.DeepClone(),
                    ["totalGrade"] = row["totalGrade"]?.DeepClone(),
                    ["sourceRowIndex"] = row["sourceRowIndex"]?.DeepClone() ?? 0,
                    ["detail"] = "بيانات مطلوبة ناقصة"
                });
            }
        }
        return Ok(new
        {
            totals = new
            {
                received = inputRows.Count,
                imported = inputRows.Count - failures.Count,
                skipped = 0,
                failed = failures.Count
            },
            groups = failures.Count == 0
                ? Array.Empty<object>()
                : new object[]
                {
                    new
                    {
                        code = "MISSING_REQUIRED",
                        labelAr = "حقول مطلوبة ناقصة",
                        rows = failures,
                        availableActions = new[] { "skip", "export" }
                    }
                }
        });
    }

    [HttpPost("api/grades/v2/commit")]
    public async Task<ActionResult<object>> CommitV2([FromBody] JsonObject body, CancellationToken ct)
    {
        var inputRows = body["rows"]?.AsArray() ?? [];
        var graduationYear = body["graduationYear"]?.GetValue<int?>() ?? DateTimeOffset.UtcNow.Year;
        var existing = await records.ListAsync("grades", ct);
        var existingNids = existing.Select(x => AdminRecordJson.StringProp(x, "nid")).Where(x => x is not null).ToHashSet();
        var inserted = 0;
        var skipped = 0;
        var nextSeat = existing.Select(x => (int)(AdminRecordJson.NumberProp(x, "seat") ?? 0)).DefaultIfEmpty(0).Max() + 1;
        foreach (var row in inputRows.OfType<JsonObject>())
        {
            var nid = AdminRecordJson.StringProp(row, "nationalId");
            var name = AdminRecordJson.StringProp(row, "nameAr");
            var total = row["totalGrade"]?.GetValue<double?>();
            if (string.IsNullOrWhiteSpace(nid) || string.IsNullOrWhiteSpace(name) || total is null)
            {
                skipped++;
                continue;
            }
            if (existingNids.Contains(nid))
            {
                skipped++;
                continue;
            }
            var seat = nextSeat++;
            var grade = GradeFromImportRow(row, seat, nid, name, total.Value, graduationYear);
            await records.UpsertAsync("grades", seat.ToString(), grade, ct);
            existingNids.Add(nid);
            inserted++;
        }
        return Ok(new { insertedCount = inserted, failedCount = skipped, alreadyImportedCount = 0 });
    }

    [HttpPost("api/grades/{seat}/adjustments")]
    public async Task<ActionResult<JsonObject>> AddAdjustment(string seat, [FromBody] JsonObject body, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        var log = row["log"]?.AsArray() ?? [];
        var entry = new JsonObject
        {
            ["id"] = $"ADJ-{Guid.NewGuid():N}",
            ["reason"] = body["reason"]?.DeepClone() ?? "OTHER",
            ["reasonLabel"] = body["reason"]?.DeepClone() ?? "أخرى",
            ["note"] = body["note"]?.DeepClone() ?? "",
            ["amount"] = body["amount"]?.DeepClone() ?? 0,
            ["by"] = body["by"]?.DeepClone() ?? "system",
            ["when"] = DateTimeOffset.UtcNow.ToString("O"),
            ["isActive"] = body["isActive"]?.DeepClone() ?? true,
            ["fresh"] = true
        };
        log.Add(entry);
        row["log"] = log;
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync("grades", seat, row, ct));
    }

    [HttpPost("api/grades/{seat}/adjustments/{entryId}/toggle")]
    public async Task<ActionResult<JsonObject>> ToggleAdjustment(string seat, string entryId, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        var log = row["log"]?.AsArray() ?? [];
        foreach (var item in log.OfType<JsonObject>().Where(x => AdminRecordJson.StringProp(x, "id") == entryId))
        {
            item["isActive"] = !(item["isActive"]?.GetValue<bool>() ?? true);
        }
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync("grades", seat, row, ct));
    }

    [HttpDelete("api/grades/{seat}/adjustments/{entryId}")]
    public async Task<ActionResult<JsonObject>> DeleteAdjustment(string seat, string entryId, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        var log = row["log"]?.AsArray() ?? [];
        row["log"] = new JsonArray(log.Where(x => x is JsonObject obj && AdminRecordJson.StringProp(obj, "id") != entryId).Select(x => x?.DeepClone()).ToArray());
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync("grades", seat, row, ct));
    }

    [HttpPatch("api/grades/{seat}/override-max")]
    public async Task<ActionResult<JsonObject>> OverrideMax(string seat, [FromBody] JsonObject body, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        row["overrideMax"] = body["overrideMax"]?.DeepClone();
        row["lastEditedBy"] = body["by"]?.DeepClone() ?? "system";
        row["lastEditedAt"] = DateTimeOffset.UtcNow.ToString("O");
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        return Ok(await records.UpsertAsync("grades", seat, row, ct));
    }

    private async Task<List<JsonObject>> FilterRows(CancellationToken ct)
    {
        var rows = await records.ListAsync("grades", ct);
        var q = Request.Query["q"].ToString();
        if (!string.IsNullOrWhiteSpace(q))
        {
            rows = rows.Where(x =>
                (AdminRecordJson.StringProp(x, "nid") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (AdminRecordJson.StringProp(x, "name") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (AdminRecordJson.StringProp(x, "seatingNumber") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        var changedOnly = bool.TryParse(Request.Query["changedOnly"], out var changed) && changed;
        if (changedOnly) rows = rows.Where(x => x["gradeChangedAt"] is not null || (x["log"]?.AsArray().Count ?? 0) > 0).ToList();
        return rows.OrderBy(x => AdminRecordJson.NumberProp(x, "seat") ?? 0).ToList();
    }

    private async Task<JsonObject> GetGradeBySeat(string seat, CancellationToken ct)
    {
        var row = await records.GetAsync("grades", seat, ct);
        if (row is not null) return row;
        throw new KeyNotFoundException("درجة الطالب غير موجودة");
    }

    private static JsonObject GradeFromImportRow(JsonObject row, int seat, string nid, string name, double total, int graduationYear) => new()
    {
        ["id"] = seat.ToString(),
        ["seat"] = seat,
        ["seatingNumber"] = AdminRecordJson.StringProp(row, "seatingNumber") ?? seat.ToString(),
        ["nid"] = nid,
        ["name"] = name,
        ["kind"] = "general",
        ["gender"] = "male",
        ["branch"] = AdminRecordJson.StringProp(row, "track") ?? "",
        ["graduationYear"] = graduationYear,
        ["schoolCategoryCode"] = AdminRecordJson.StringProp(row, "schoolCategory"),
        ["school"] = AdminRecordJson.StringProp(row, "schoolName") ?? "",
        ["region"] = AdminRecordJson.StringProp(row, "regionName") ?? "",
        ["examRound"] = AdminRecordJson.StringProp(row, "examRound"),
        ["total"] = total,
        ["importMax"] = row["maxGrade"]?.GetValue<double?>() ?? 410,
        ["overrideMax"] = null,
        ["lastEditedAt"] = null,
        ["lastEditedBy"] = null,
        ["gradeChangedAt"] = null,
        ["previousGrade"] = null,
        ["status"] = "مستجد",
        ["log"] = new JsonArray()
    };
}
