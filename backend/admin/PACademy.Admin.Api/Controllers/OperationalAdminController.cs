using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class OperationalAdminController(OperationalRecordsService records, ILookupsDbContext lookups, GeneralSettingsService generalSettings) : ControllerBase
{
    [HttpGet("api/committee-instances")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> CommitteeInstances(CancellationToken ct)
    {
        var rows = await ListCommitteeInstancesAsync(null, null, null, ct);
        await SaveChangedReservationSnapshotsAsync(rows, ct);
        return Ok(rows);
    }

    [HttpPost("api/committee-instances")]
    public async Task<ActionResult<object>> AddCommitteeInstances([FromBody] JsonNode body, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        if (body is JsonArray arr)
        {
            // Snapshot only the inserted rows — rewriting every instance in the
            // table here made bulk adds time out at the gateway after the insert
            // had already committed.
            var inserted = new List<JsonObject>();
            foreach (var node in arr.OfType<JsonObject>())
            {
                var id = AdminRecordJson.StringProp(node, "id") ?? $"CI-{Guid.NewGuid():N}";
                node["id"] = id;
                node["createdAt"] ??= now;
                node["updatedAt"] = now;
                inserted.Add(node);
            }
            await ApplyReservationSnapshotAsync(inserted, ct);
            foreach (var node in inserted)
            {
                await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(node, "id")!, node, ct);
            }
            return Ok(await ListCommitteeInstancesAsync(null, null, null, ct));
        }
        var obj = body as JsonObject ?? [];
        var singleId = AdminRecordJson.StringProp(obj, "id") ?? $"CI-{Guid.NewGuid():N}";
        obj["id"] = singleId;
        obj["createdAt"] ??= now;
        obj["updatedAt"] = now;
        await ApplyReservationSnapshotAsync([obj], ct);
        var saved = await records.UpsertAsync("committeeInstances", singleId, obj, ct);
        return Ok(saved);
    }

    [HttpPatch("api/committee-instances/{id}")]
    public async Task<ActionResult<JsonObject>> UpdateCommitteeInstance(string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        body["updatedAt"] = now;
        var saved = await records.UpsertAsync("committeeInstances", id, body, ct);
        await SaveReservationSnapshotAsync([saved], ct);
        return Ok(saved);
    }

    [HttpDelete("api/committee-instances/{id}")]
    public async Task<ActionResult<object>> DeleteCommitteeInstance(string id, CancellationToken ct)
    {
        var target = await records.GetAsync("committeeInstances", id, ct);
        EnsureCommitteeInstanceCanBeDeleted(target);
        return Ok(new { deleted = await records.DeleteAsync("committeeInstances", id, ct) });
    }

    [HttpPost("api/committee-instances/refresh-reserved")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> RefreshReserved([FromBody] JsonObject? filters, CancellationToken ct)
    {
        var rows = await ListCommitteeInstancesAsync(
            filters is null ? null : AdminRecordJson.StringProp(filters, "cycleId"),
            filters is null ? null : AdminRecordJson.StringProp(filters, "categoryKey"),
            filters is null ? null : AdminRecordJson.StringProp(filters, "definitionCode"),
            ct);
        await SaveChangedReservationSnapshotsAsync(rows, ct);
        return Ok(rows);
    }

    [HttpDelete("api/committee-instances")]
    public async Task<ActionResult<object>> DeleteCommitteeDay(
        [FromQuery] string? date,
        [FromQuery] string? categoryKey,
        [FromQuery] string? cycleId,
        CancellationToken ct)
    {
        var instances = await records.ListAsync("committeeInstances", ct);
        var targets = instances.Where(x =>
            (string.IsNullOrWhiteSpace(date) || AdminRecordJson.StringProp(x, "date") == date) &&
            (string.IsNullOrWhiteSpace(cycleId) || AdminRecordJson.StringProp(x, "cycleId") == cycleId) &&
            (string.IsNullOrWhiteSpace(categoryKey) || AdminRecordJson.StringProp(x, "categoryKey") == categoryKey)).ToList();
        foreach (var target in targets) EnsureCommitteeInstanceCanBeDeleted(target);
        foreach (var target in targets)
        {
            await records.DeleteAsync("committeeInstances", AdminRecordJson.StringProp(target, "id")!, ct);
        }
        return Ok(targets);
    }

    [HttpPost("api/committee-instances/transfer-day")]
    [HttpPost("api/committee-instances/{id}/transfer")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> TransferCommitteeDay(string? id, [FromBody] JsonObject? body, CancellationToken ct)
    {
        var fromDate = body is null ? null : AdminRecordJson.StringProp(body, "fromDate");
        var toDate = body is null ? null : AdminRecordJson.StringProp(body, "toDate");
        var instances = await records.ListAsync("committeeInstances", ct);
        var targets = instances.Where(x =>
            (!string.IsNullOrWhiteSpace(id) && AdminRecordJson.StringProp(x, "id") == id) ||
            (!string.IsNullOrWhiteSpace(fromDate) && AdminRecordJson.StringProp(x, "date") == fromDate)).ToList();
        foreach (var target in targets)
        {
            if (!string.IsNullOrWhiteSpace(toDate)) target["date"] = toDate;
            target["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(target, "id")!, target, ct);
        }
        return Ok(await records.ListAsync("committeeInstances", ct));
    }

    private static void EnsureCommitteeInstanceCanBeDeleted(JsonObject? target)
    {
        if (target is null) return;
        var reserved = AdminRecordJson.NumberProp(target, "reserved") ??
                       AdminRecordJson.NumberProp(target, "reservedCount") ??
                       0;
        if (reserved > 0)
        {
            throw new ConflictException(
                "COMMITTEE_INSTANCE_HAS_BOOKINGS",
                "لا يمكن حذف موعد لجنة يحتوي على حجوزات قائمة للمتقدمين.",
                new
                {
                    id = AdminRecordJson.StringProp(target, "id"),
                    date = AdminRecordJson.StringProp(target, "date"),
                    reserved
                });
        }
    }

    private async Task<List<JsonObject>> ListCommitteeInstancesAsync(
        string? cycleId,
        string? categoryKey,
        string? definitionCode,
        CancellationToken ct)
    {
        var activeCategoryCodes = await lookups.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "applicant-categories" && x.IsActive)
            .Select(x => x.Code)
            .ToListAsync(ct);
        var active = activeCategoryCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rows = (await records.ListAsync("committeeInstances", ct))
            .Where(row =>
            {
                var rowCategoryKey = AdminRecordJson.StringProp(row, "categoryKey");
                return !string.IsNullOrWhiteSpace(rowCategoryKey) &&
                    active.Contains(rowCategoryKey) &&
                    (string.IsNullOrWhiteSpace(cycleId) || AdminRecordJson.StringProp(row, "cycleId") == cycleId) &&
                    (string.IsNullOrWhiteSpace(categoryKey) || rowCategoryKey == categoryKey) &&
                    (string.IsNullOrWhiteSpace(definitionCode) || AdminRecordJson.StringProp(row, "definitionCode") == definitionCode);
            })
            .ToList();

        return rows;
    }

    private async Task ApplyReservationSnapshotAsync(IReadOnlyList<JsonObject> instances, CancellationToken ct)
    {
        if (instances.Count == 0) return;

        var applicants = await records.ListAsync("applicants", ct);
        var definitionNameByCode = await CommitteeDefinitionNameMapAsync(ct);
        var refreshedAt = DateTimeOffset.UtcNow.ToString("O");
        foreach (var instance in instances)
        {
            instance["reserved"] = CountReservations(applicants, instance, definitionNameByCode);
            instance["reservedRefreshedAt"] = refreshedAt;
            instance["updatedAt"] = refreshedAt;
        }
    }

    private async Task SaveReservationSnapshotAsync(IReadOnlyList<JsonObject> instances, CancellationToken ct)
    {
        await ApplyReservationSnapshotAsync(instances, ct);
        foreach (var instance in instances)
        {
            await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(instance, "id")!, instance, ct);
        }
    }

    private async Task SaveChangedReservationSnapshotsAsync(IReadOnlyList<JsonObject> instances, CancellationToken ct)
    {
        if (instances.Count == 0) return;

        var applicants = await records.ListAsync("applicants", ct);
        var definitionNameByCode = await CommitteeDefinitionNameMapAsync(ct);
        var refreshedAt = DateTimeOffset.UtcNow.ToString("O");
        foreach (var instance in instances)
        {
            var nextReserved = CountReservations(applicants, instance, definitionNameByCode);
            var currentReserved = AdminRecordJson.NumberProp(instance, "reserved");
            var hasTimestamp = !string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(instance, "reservedRefreshedAt"));
            if (currentReserved == nextReserved && hasTimestamp) continue;

            instance["reserved"] = nextReserved;
            instance["reservedRefreshedAt"] = refreshedAt;
            instance["updatedAt"] = refreshedAt;
            await records.UpsertAsync("committeeInstances", AdminRecordJson.StringProp(instance, "id")!, instance, ct);
        }
    }

    private async Task<Dictionary<string, string>> CommitteeDefinitionNameMapAsync(CancellationToken ct)
    {
        var definitions = await lookups.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == "committees")
            .Select(x => new { x.Code, x.Name })
            .ToListAsync(ct);
        var definitionNameByCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var definition in definitions)
        {
            if (!string.IsNullOrWhiteSpace(definition.Code) && !string.IsNullOrWhiteSpace(definition.Name))
            {
                definitionNameByCode[definition.Code] = definition.Name;
            }
        }

        var committeeRecords = await records.ListAsync("committees", ct);
        foreach (var committee in committeeRecords)
        {
            var code = AdminRecordJson.StringProp(committee, "id") ??
                       AdminRecordJson.StringProp(committee, "code") ??
                       AdminRecordJson.StringProp(committee, "definitionCode");
            var name = AdminRecordJson.StringProp(committee, "name") ??
                       AdminRecordJson.StringProp(committee, "nameAr");
            if (!string.IsNullOrWhiteSpace(code) && !string.IsNullOrWhiteSpace(name))
            {
                definitionNameByCode[code] = name;
            }
        }

        return definitionNameByCode;
    }

    private static int CountReservations(
        IReadOnlyList<JsonObject> applicants,
        JsonObject instance,
        IReadOnlyDictionary<string, string> definitionNameByCode)
    {
        var definitionCode = AdminRecordJson.StringProp(instance, "definitionCode");
        var committeeName = definitionCode is not null && definitionNameByCode.TryGetValue(definitionCode, out var mappedName)
            ? mappedName
            : null;
        var cycleId = AdminRecordJson.StringProp(instance, "cycleId");
        var date = AdminRecordJson.StringProp(instance, "date");

        return applicants.Count(applicant =>
        {
            if (!ApplicantMatchesCommittee(applicant, definitionCode, committeeName)) return false;
            if (!ApplicantMatchesOptionalField(applicant, cycleId, "cycleId", "admissionCycleId")) return false;
            if (!ApplicantMatchesOptionalDate(applicant, date)) return false;
            return true;
        });
    }

    private static bool ApplicantMatchesCommittee(JsonObject applicant, string? definitionCode, string? committeeName)
    {
        var applicantCommitteeCode =
            AdminRecordJson.StringProp(applicant, "committeeId") ??
            AdminRecordJson.StringProp(applicant, "committeeCode") ??
            AdminRecordJson.StringProp(applicant, "definitionCode");
        if (!string.IsNullOrWhiteSpace(definitionCode) &&
            string.Equals(applicantCommitteeCode, definitionCode, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var applicantCommitteeName =
            AdminRecordJson.StringProp(applicant, "committee") ??
            AdminRecordJson.StringProp(applicant, "committeeName") ??
            AdminRecordJson.StringProp(applicant, "committeeLabelAr");
        return !string.IsNullOrWhiteSpace(committeeName) &&
            string.Equals(applicantCommitteeName, committeeName, StringComparison.Ordinal);
    }

    private static bool ApplicantMatchesOptionalField(JsonObject applicant, string? expected, params string[] keys)
    {
        if (string.IsNullOrWhiteSpace(expected)) return true;
        foreach (var key in keys)
        {
            var actual = AdminRecordJson.StringProp(applicant, key);
            if (!string.IsNullOrWhiteSpace(actual))
            {
                return string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase);
            }
        }
        return true;
    }

    private static bool ApplicantMatchesOptionalDate(JsonObject applicant, string? expectedDate)
    {
        if (string.IsNullOrWhiteSpace(expectedDate)) return true;
        var actualDate =
            AdminRecordJson.StringProp(applicant, "examDate") ??
            AdminRecordJson.StringProp(applicant, "date") ??
            AdminRecordJson.StringProp(applicant, "scheduledDate") ??
            AdminRecordJson.StringProp(applicant, "examSlotDate") ??
            NestedStringProp(applicant, "examSlot", "date");
        if (string.IsNullOrWhiteSpace(actualDate)) return true;
        return string.Equals(actualDate.Length >= 10 ? actualDate[..10] : actualDate, expectedDate, StringComparison.Ordinal);
    }

    private static string? NestedStringProp(JsonObject obj, string parentKey, string childKey)
    {
        return obj.TryGetPropertyValue(parentKey, out var node) && node is JsonObject child
            ? AdminRecordJson.StringProp(child, childKey)
            : null;
    }

    [HttpGet("api/v1/admin/workflows")]
    [RequireBearerAuth]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Workflows(CancellationToken ct) => Ok(await records.ListAsync("workflows", ct));

    [HttpGet("api/v1/admin/workflows/{id}")]
    public async Task<ActionResult<JsonObject?>> Workflow(string id, CancellationToken ct)
    {
        var row = await records.GetAsync("workflows", id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("api/v1/admin/workflows/by-department")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject?>> WorkflowByDepartment([FromQuery] string? department, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]> { ["department"] = ["القسم مطلوب"] },
                Message: "تحقق من البيانات المدخلة"));
        }

        var row = (await records.ListAsync("workflows", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "department") == department);
        return row is null ? NotFound(new ApiErrorEnvelope(ErrorCodes.NotFound, Message: "مسار العمل غير موجود")) : Ok(row);
    }

    [HttpPost("api/v1/admin/workflows")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> CreateWorkflow([FromBody] JsonObject body, CancellationToken ct)
    {
        var id = AdminRecordJson.StringProp(body, "id") ?? $"WF-{Guid.NewGuid():N}";
        body["id"] = id;
        return Ok(await records.UpsertAsync("workflows", id, body, ct));
    }

    [HttpPut("api/v1/admin/workflows/{id}")]
    [HttpPost("api/v1/admin/workflows/{id}/reorder")]
    [HttpPost("api/v1/admin/workflows/{id}/apply")]
    public async Task<ActionResult<JsonObject>> MutateWorkflow(string id, [FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await records.UpsertAsync("workflows", id, body, ct));

    [HttpDelete("api/v1/admin/workflows/{id}")]
    public async Task<ActionResult<object>> DeleteWorkflow(string id, CancellationToken ct) =>
        Ok(new { deleted = await records.DeleteAsync("workflows", id, ct) });

    [HttpGet("api/admin/settings")]
    public async Task<ActionResult<JsonObject>> Settings(CancellationToken ct) =>
        Ok(await generalSettings.GetAsync(ct));

    [HttpPatch("api/admin/settings")]
    public async Task<ActionResult<JsonObject>> UpdateSettings([FromBody] JsonObject body, CancellationToken ct) =>
        Ok(await generalSettings.UpdateAsync(body, ct));
}
