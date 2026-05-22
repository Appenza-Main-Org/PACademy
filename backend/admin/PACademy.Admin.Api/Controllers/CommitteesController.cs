using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/committees")]
public sealed class CommitteesController(AdminRecordsService records, IIdentityDbContext identity) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> List(CancellationToken ct) => Ok(await records.ListAsync("committees", ct));

    [HttpGet("eligible-officers")]
    public async Task<ActionResult<IReadOnlyList<object>>> EligibleOfficers(CancellationToken ct)
    {
        var rows = await identity.Users.AsNoTracking()
            .Where(x => x.Role == "committee_admin" || x.Role == "committee_user")
            .OrderBy(x => x.FullArabicName)
            .ToListAsync(ct);
        return Ok(rows.Select(x => new { id = x.Id, name = x.FullArabicName, role = x.Role }).ToList());
    }

    [HttpGet("specializations")]
    public async Task<ActionResult<IReadOnlyList<object>>> Specializations(CancellationToken ct)
    {
        var categories = await records.ListAsync("categories", ct);
        if (categories.Count > 0)
        {
            return Ok(categories.Select(x => new
            {
                id = AdminRecordJson.StringProp(x, "key") ?? AdminRecordJson.StringProp(x, "id"),
                nameAr = AdminRecordJson.StringProp(x, "labelAr") ?? AdminRecordJson.StringProp(x, "nameAr"),
                code = AdminRecordJson.StringProp(x, "labelEn") ?? AdminRecordJson.StringProp(x, "key"),
                active = x["deletedAt"] is null && (x["isOpen"]?.GetValue<bool?>() ?? true)
            }).ToList());
        }

        var committees = await records.ListAsync("committees", ct);
        var labels = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["officers_general"] = "قسم الضباط (قسم عام)",
            ["law_bachelor"] = "ليسانس حقوق",
            ["physical_education_bachelor"] = "بكالوريوس تربية رياضية",
            ["specialized_officers"] = "الضباط المتخصصون"
        };
        return Ok(committees
            .Select(x => AdminRecordJson.StringProp(x, "categoryKey"))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .Select(x => new { id = x, nameAr = labels.GetValueOrDefault(x!, x!), code = x, active = true })
            .ToList());
    }

    [HttpGet("assignable/{applicantId}")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Assignable(string applicantId, CancellationToken ct)
    {
        var applicant = (await records.ListAsync("applicants", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "id") == applicantId);
        if (applicant is null) return Ok(Array.Empty<JsonObject>());
        var applicantCommittee = AdminRecordJson.StringProp(applicant, "committee");
        var committees = await records.ListAsync("committees", ct);
        return Ok(committees.Where(c =>
        {
            var status = AdminRecordJson.StringProp(c, "status") ?? "active";
            var capacity = AdminRecordJson.NumberProp(c, "capacity") ?? AdminRecordJson.NumberProp(c, "capacityPerDay") ?? 999;
            var applicants = AdminRecordJson.NumberProp(c, "applicants") ?? 0;
            return status != "inactive" && applicants < capacity &&
                (string.IsNullOrWhiteSpace(applicantCommittee) || AdminRecordJson.StringProp(c, "name") == applicantCommittee);
        }).ToList());
    }

    [HttpGet("applicants")]
    public async Task<ActionResult<object>> Applicants(CancellationToken ct)
    {
        var committeeName = Request.Query["committeeName"].ToString();
        if (string.IsNullOrWhiteSpace(committeeName)) return Ok(await records.PageAsync("applicants", Request.Query, ct));
        var rows = (await records.ListAsync("applicants", ct)).Where(x => AdminRecordJson.StringProp(x, "committee") == committeeName).Take(50).ToList();
        return Ok(rows);
    }

    [HttpGet("schedule")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Schedule(CancellationToken ct) => Ok(await records.ListAsync("committeeInstances", ct));

    [HttpPost("schedule")]
    [HttpPost("schedule/batch")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> SaveSchedule([FromBody] JsonNode? body, CancellationToken ct)
    {
        if (body is JsonArray array)
        {
            foreach (var row in array.OfType<JsonObject>())
            {
                ValidateScheduleRow(row);
                var id = AdminRecordJson.StringProp(row, "id") ?? $"CI-{Guid.NewGuid():N}";
                row["id"] = id;
                await records.UpsertAsync("committeeInstances", id, row, ct);
            }
        }
        else if (body is JsonObject obj)
        {
            var entries = obj["entries"] as JsonArray ?? obj["rows"] as JsonArray;
            if (entries is not null)
            {
                foreach (var row in entries.OfType<JsonObject>())
                {
                    ValidateScheduleRow(row);
                    var id = AdminRecordJson.StringProp(row, "id") ?? $"CI-{Guid.NewGuid():N}";
                    row["id"] = id;
                    await records.UpsertAsync("committeeInstances", id, row, ct);
                }
            }
        }
        return Ok(await records.ListAsync("committeeInstances", ct));
    }

    [HttpPatch("schedule/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateSchedule(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        ValidateScheduleRow(body);
        return Ok(await records.UpsertAsync("committeeInstances", id, body, ct));
    }

    [HttpDelete("schedule/{id}")]
    public async Task<ActionResult<object>> DeleteSchedule(string id, CancellationToken ct) => Ok(new { deleted = await records.DeleteAsync("committeeInstances", id, ct) });

    [HttpGet("{id}")]
    public async Task<ActionResult<JsonObject?>> Get(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("committees", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<JsonObject>> Create([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(body, "id") ?? $"COM-{Guid.NewGuid():N}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("committees", id, body, ct));
    }

    [HttpPatch("{id}")]
    [HttpPost("{id}/status")]
    [HttpPost("{id}/schedule")]
    [HttpPost("{id}/soft-delete")]
    [HttpPost("{id}/restore")]
    public async Task<ActionResult<JsonObject>> Mutate(string id, [FromBody] JsonObject? body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("committees", id, body ?? [], ct));

    [HttpGet("{id}/dependencies")]
    public async Task<ActionResult<object>> Dependencies(string id, CancellationToken ct)
    {
        var committee = await records.GetAsync("committees", id, ct) ?? throw new EntityNotFoundException("اللجنة غير موجودة");
        var name = AdminRecordJson.StringProp(committee, "name");
        var applicants = (await records.ListAsync("applicants", ct)).Count(x => AdminRecordJson.StringProp(x, "committee") == name);
        var results = (await records.ListAsync("committeeResults", ct)).Count(x => AdminRecordJson.StringProp(x, "committeeId") == id);
        return Ok(new { counts = new { applicants, results }, blocking = applicants > 0 || results > 0 });
    }

    [HttpGet("{id}/queue")]
    [HttpGet("{id}/results")]
    [HttpGet("{id}/applicants")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CommitteeLists(string id, CancellationToken ct)
    {
        var path = Request.Path.Value ?? "";
        if (path.EndsWith("/results", StringComparison.OrdinalIgnoreCase))
            return Ok((await records.ListAsync("committeeResults", ct)).Where(x => AdminRecordJson.StringProp(x, "committeeId") == id).ToList());

        var committee = await records.GetAsync("committees", id, ct);
        if (committee is null) return Ok(Array.Empty<JsonObject>());
        var name = AdminRecordJson.StringProp(committee, "name");
        var applicants = (await records.ListAsync("applicants", ct)).Where(x => AdminRecordJson.StringProp(x, "committee") == name);
        if (path.EndsWith("/queue", StringComparison.OrdinalIgnoreCase))
            applicants = applicants.Take(18);
        return Ok(applicants.ToList());
    }

    [HttpPost("{id}/results")]
    [HttpPost("{id}/results/approve")]
    [HttpPost("{id}/results/bulk-upload")]
    [HttpPost("results/{resultId}/reject")]
    public async Task<ActionResult<object>> ResultMutation(string? id, string? resultId, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var path = Request.Path.Value ?? "";
        if (path.EndsWith("/approve", StringComparison.OrdinalIgnoreCase))
        {
            var ids = body?["resultIds"] as JsonArray ?? [];
            var approved = 0;
            foreach (var node in ids)
            {
                var rid = node?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(rid)) continue;
                var current = await records.GetAsync("committeeResults", rid, ct);
                if (current is null) continue;
                current["phase"] = "final";
                current["approvedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                await records.UpsertAsync("committeeResults", rid, current, ct);
                approved++;
            }
            return Ok(new { approved, failed = ids.Count - approved });
        }

        if (!string.IsNullOrWhiteSpace(resultId))
        {
            var current = await records.GetAsync("committeeResults", resultId, ct) ?? new JsonObject { ["id"] = resultId };
            current["phase"] = "rejected";
            current["rejectionReason"] = body?["reason"]?.DeepClone();
            return Ok(await records.UpsertAsync("committeeResults", resultId, current, ct));
        }

        if (path.EndsWith("/bulk-upload", StringComparison.OrdinalIgnoreCase))
        {
            var rows = body?["rows"] as JsonArray ?? [];
            var imported = 0;
            var errors = new JsonArray();
            foreach (var row in rows.OfType<JsonObject>())
            {
                if (string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "applicantId")) || string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "passFail")))
                {
                    errors.Add(new JsonObject { ["row"] = imported + errors.Count + 1, ["message"] = "بيانات ناقصة" });
                    continue;
                }
                row["committeeId"] = id;
                row["id"] = AdminRecordJson.StringProp(row, "id") ?? $"RES-C-{Guid.NewGuid():N}";
                await records.UpsertAsync("committeeResults", AdminRecordJson.StringProp(row, "id")!, row, ct);
                imported++;
            }
            return Ok(new { imported, errors });
        }

        var payload = body ?? [];
        var newId = AdminRecordJson.StringProp(payload, "id") ?? $"RES-C-{Guid.NewGuid():N}";
        payload["id"] = newId;
        payload["committeeId"] = id;
        payload["enteredAt"] ??= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        payload["phase"] ??= "preliminary";
        return Ok(await records.UpsertAsync("committeeResults", newId, payload, ct));
    }

    private static void ValidateScheduleRow(JsonObject row)
    {
        var capacity = AdminRecordJson.NumberProp(row, "capacity") ?? AdminRecordJson.NumberProp(row, "capacityPerDay");
        var reserved = AdminRecordJson.NumberProp(row, "reserved") ?? AdminRecordJson.NumberProp(row, "reservedCount");
        if (capacity is < 0) throw new ConflictException("CAPACITY_INVALID", "السعة لا يمكن أن تكون سالبة");
        if (capacity is not null && reserved is not null && reserved > capacity)
            throw new ConflictException(ErrorCodes.CommitteeAtCapacity, "الحجوزات الحالية تتجاوز سعة اللجنة");
    }
}
