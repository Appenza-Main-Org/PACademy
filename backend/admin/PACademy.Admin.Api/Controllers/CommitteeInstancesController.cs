using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/committee-instances")]
public sealed class CommitteeInstancesController(CyclesAdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? cycleId,
        [FromQuery] string? categoryKey,
        [FromQuery] string? definitionCode,
        CancellationToken ct)
        => Ok((await Bucket(ct))
            .Where(x => cycleId is null || ReadString(x, "cycleId") == cycleId)
            .Where(x => categoryKey is null || ReadString(x, "categoryKey") == categoryKey)
            .Where(x => definitionCode is null || ReadString(x, "definitionCode") == definitionCode)
            .OrderBy(x => ReadString(x, "cycleId"))
            .ThenBy(x => ReadString(x, "date"))
            .ThenBy(x => ReadString(x, "definitionCode"))
            .ToList());

    [HttpPost]
    public async Task<IActionResult> AddMany([FromBody] JsonArray body, CancellationToken ct)
    {
        var rows = await Bucket(ct);
        var now = DateTimeOffset.UtcNow.ToString("O");
        var created = new List<JsonObject>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var nextSerial = await NextSerial(ct);

        foreach (var node in body)
        {
            if (node is not JsonObject input)
            {
                return ConflictEnvelope("INVALID_ROW", "صف موعد اللجنة غير صحيح");
            }

            var capacity = ReadInt(input, "capacity");
            var capacityConflict = ValidateCapacity(capacity, input["capacity"]);
            if (capacityConflict is not null) return capacityConflict;

            var cycleId = ReadString(input, "cycleId");
            var categoryKey = ReadString(input, "categoryKey");
            var definitionCode = ReadString(input, "definitionCode");
            var date = ReadString(input, "date");
            if (string.IsNullOrWhiteSpace(cycleId) ||
                string.IsNullOrWhiteSpace(categoryKey) ||
                string.IsNullOrWhiteSpace(definitionCode) ||
                string.IsNullOrWhiteSpace(date))
            {
                return ConflictEnvelope("INVALID_ROW", "بيانات موعد اللجنة غير مكتملة");
            }

            var key = UniqueKey(cycleId, definitionCode, date);
            if (!seen.Add(key) || rows.Any(x => UniqueKey(x) == key))
            {
                return ConflictEnvelope(
                    "COMMITTEE_INSTANCE_DUPLICATE",
                    "هذا الموعد لهذه اللجنة في هذه الدورة موجود بالفعل.",
                    new JsonObject
                    {
                        ["cycleId"] = cycleId,
                        ["definitionCode"] = definitionCode,
                        ["date"] = date,
                    });
            }

            var row = new JsonObject
            {
                ["id"] = $"CIN-{nextSerial++:0000}",
                ["definitionCode"] = definitionCode,
                ["cycleId"] = cycleId,
                ["categoryKey"] = categoryKey,
                ["date"] = date,
                ["capacity"] = capacity,
                ["reserved"] = 0,
                ["reservedRefreshedAt"] = now,
                ["createdAt"] = now,
                ["updatedAt"] = now,
            };
            created.Add(row);
            rows.Add(row);
        }

        foreach (var row in created)
        {
            await Upsert(ReadString(row, "id")!, row, ct);
        }

        return Ok(created);
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Patch([FromRoute] string id, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var row = await Get(id, ct);
        if (row is null) return NotFound(new { code = "NOT_FOUND", message = "الموعد غير موجود" });

        var originalDate = ReadString(row, "date") ?? "";
        var editableConflict = ValidateEditableDay(originalDate);
        if (editableConflict is not null) return editableConflict;

        if (patch.TryGetPropertyValue("date", out var dateNode) && dateNode is not null)
        {
            var nextDate = dateNode.GetValue<string>();
            editableConflict = ValidateEditableDay(nextDate);
            if (editableConflict is not null) return editableConflict;
            row["date"] = nextDate;
        }

        if (patch.TryGetPropertyValue("capacity", out var capacityNode))
        {
            var capacity = ReadInt(patch, "capacity");
            var capacityConflict = ValidateCapacity(capacity, capacityNode);
            if (capacityConflict is not null) return capacityConflict;
            row["capacity"] = capacity;
        }

        var rows = await Bucket(ct);
        if (rows.Any(x => ReadString(x, "id") != id && UniqueKey(x) == UniqueKey(row)))
        {
            return ConflictEnvelope(
                "COMMITTEE_INSTANCE_DUPLICATE",
                "يوجد موعد آخر لهذه اللجنة في نفس التاريخ.",
                new JsonObject
                {
                    ["cycleId"] = ReadString(row, "cycleId"),
                    ["definitionCode"] = ReadString(row, "definitionCode"),
                    ["date"] = ReadString(row, "date"),
                });
        }

        var reserved = ReadInt(row, "reserved") ?? 0;
        var capacityValue = ReadInt(row, "capacity") ?? 0;
        if (capacityValue > 0 && reserved > capacityValue)
        {
            row["reserved"] = capacityValue;
        }

        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert(id, row, ct);
        return Ok(row);
    }

    [HttpPost("refresh-reserved")]
    public async Task<IActionResult> RefreshReserved([FromBody] JsonObject? body, CancellationToken ct)
    {
        var cycleId = body is null ? null : ReadString(body, "cycleId");
        var categoryKey = body is null ? null : ReadString(body, "categoryKey");
        var definitionCode = body is null ? null : ReadString(body, "definitionCode");
        var now = DateTimeOffset.UtcNow.ToString("O");
        var touched = new List<JsonObject>();

        foreach (var row in await Bucket(ct))
        {
            if (cycleId is not null && ReadString(row, "cycleId") != cycleId) continue;
            if (categoryKey is not null && ReadString(row, "categoryKey") != categoryKey) continue;
            if (definitionCode is not null && ReadString(row, "definitionCode") != definitionCode) continue;
            row["reservedRefreshedAt"] = now;
            row["updatedAt"] = now;
            await Upsert(ReadString(row, "id")!, row, ct);
            touched.Add(row);
        }

        return Ok(touched);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete([FromRoute] string id, CancellationToken ct)
    {
        var row = await Get(id, ct);
        if (row is null) return NoContent();

        var editableConflict = ValidateEditableDay(ReadString(row, "date") ?? "");
        if (editableConflict is not null) return editableConflict;
        var bookingConflict = ValidateNoBookings(row);
        if (bookingConflict is not null) return bookingConflict;

        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == BucketName && x.Id == id, ct);
        if (item is not null)
        {
            db.Items.Remove(item);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteDay([FromQuery] string cycleId, [FromQuery] string date, CancellationToken ct)
    {
        var editableConflict = ValidateEditableDay(date);
        if (editableConflict is not null) return editableConflict;

        var rows = (await Bucket(ct))
            .Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "date") == date)
            .ToList();
        var blocking = rows.FirstOrDefault(x => (ReadInt(x, "reserved") ?? 0) > 0);
        if (blocking is not null) return ValidateNoBookings(blocking)!;

        foreach (var row in rows)
        {
            var id = ReadString(row, "id");
            if (id is null) continue;
            var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == BucketName && x.Id == id, ct);
            if (item is not null) db.Items.Remove(item);
        }
        await db.SaveChangesAsync(ct);
        return Ok(rows);
    }

    [HttpPost("transfer-day")]
    public async Task<IActionResult> TransferDay([FromBody] JsonObject body, CancellationToken ct)
    {
        var cycleId = ReadString(body, "cycleId") ?? "";
        var fromDate = ReadString(body, "fromDate") ?? "";
        var toDate = ReadString(body, "toDate") ?? "";
        if (fromDate == toDate)
        {
            return Ok(new { transferred = 0, createdAtDestination = 0, bumped = 0, totalReservationsMoved = 0 });
        }

        var editableConflict = ValidateEditableDay(fromDate) ?? ValidateEditableDay(toDate);
        if (editableConflict is not null) return editableConflict;

        var rows = await Bucket(ct);
        var sourceDay = rows.Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "date") == fromDate).ToList();
        var destinationDay = rows.Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "date") == toDate).ToList();
        if (!SameCommitteeSet(sourceDay, destinationDay))
        {
            return ConflictEnvelope(
                "COMMITTEE_INSTANCE_SET_MISMATCH",
                "لا يمكن النقل إلا إلى يوم يحتوي نفس لجان المصدر لكل فئة.",
                new JsonObject { ["fromDate"] = fromDate, ["toDate"] = toDate });
        }

        var sourceRows = sourceDay.Where(x => (ReadInt(x, "reserved") ?? 0) > 0).ToList();
        var mode = ReadString(body, "mode") ?? "move-only";
        var overrides = ReadOverrides(body["capacityOverrides"]);
        var plan = new List<PlannedTransfer>();
        var conflicts = new JsonArray();

        foreach (var source in sourceRows)
        {
            var bookingConflict = ValidateBookingsWithinCapacity(source);
            if (bookingConflict is not null) return bookingConflict;
            var destination = destinationDay.FirstOrDefault(x =>
                ReadString(x, "definitionCode") == ReadString(source, "definitionCode") &&
                ReadString(x, "categoryKey") == ReadString(source, "categoryKey"));
            if (destination is null)
            {
                return ConflictEnvelope(
                    "COMMITTEE_INSTANCE_SET_MISMATCH",
                    "لا يمكن النقل إلا إلى يوم يحتوي نفس لجان المصدر لكل فئة.",
                    new JsonObject
                    {
                        ["fromDate"] = fromDate,
                        ["toDate"] = toDate,
                        ["definitionCode"] = ReadString(source, "definitionCode"),
                    });
            }

            bookingConflict = ValidateBookingsWithinCapacity(destination);
            if (bookingConflict is not null) return bookingConflict;
            var reservedToMove = ReadInt(source, "reserved") ?? 0;
            var destinationId = ReadString(destination, "id")!;
            var destinationCapacity = ResolveDestinationCapacity(destination, reservedToMove, mode, overrides.GetValueOrDefault(destinationId));
            var capacityConflict = ValidateCapacity(destinationCapacity, JsonValue.Create(destinationCapacity));
            if (capacityConflict is not null) return capacityConflict;
            var destinationReserved = ReadInt(destination, "reserved") ?? 0;
            var freeSeats = destinationCapacity - destinationReserved;
            if (freeSeats < reservedToMove)
            {
                conflicts.Add(TransferConflict(source, destination, destinationCapacity, freeSeats, reservedToMove));
                continue;
            }

            plan.Add(new PlannedTransfer(ReadString(source, "id")!, destinationId, reservedToMove, destinationCapacity));
        }

        if (conflicts.Count > 0)
        {
            return ConflictEnvelope(
                "RESERVATIONS_OVER_DESTINATION_CAPACITY",
                "بعض لجان اليوم المستهدف ليس بها سعة كافية لاستيعاب الحجوزات. زِد السعة لهذه اللجان أو اختر يوماً آخر.",
                new JsonObject { ["conflicts"] = conflicts });
        }

        return Ok(await ApplyTransferPlan(cycleId, fromDate, plan, ct));
    }

    [HttpPost("{id}/transfer")]
    public async Task<IActionResult> TransferOne([FromRoute] string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var source = await Get(id, ct);
        if (source is null) return NotFound(new { code = "NOT_FOUND", message = "الموعد غير موجود" });
        var toDate = ReadString(body, "toDate") ?? "";
        var sourceDate = ReadString(source, "date") ?? "";
        var sourceReserved = ReadInt(source, "reserved") ?? 0;
        if (sourceDate == toDate || sourceReserved == 0)
        {
            return Ok(new { transferred = 0, createdAtDestination = 0, bumped = 0, totalReservationsMoved = 0 });
        }

        var editableConflict = ValidateEditableDay(sourceDate) ?? ValidateEditableDay(toDate);
        if (editableConflict is not null) return editableConflict;
        var bookingConflict = ValidateBookingsWithinCapacity(source);
        if (bookingConflict is not null) return bookingConflict;

        var rows = await Bucket(ct);
        var destination = rows.FirstOrDefault(x =>
            ReadString(x, "cycleId") == ReadString(source, "cycleId") &&
            ReadString(x, "definitionCode") == ReadString(source, "definitionCode") &&
            ReadString(x, "categoryKey") == ReadString(source, "categoryKey") &&
            ReadString(x, "date") == toDate);
        if (destination is null)
        {
            return ConflictEnvelope(
                "COMMITTEE_INSTANCE_SET_MISMATCH",
                "لا يمكن النقل إلا إلى يوم يحتوي نفس اللجنة لنفس الفئة.",
                new JsonObject
                {
                    ["fromDate"] = sourceDate,
                    ["toDate"] = toDate,
                    ["definitionCode"] = ReadString(source, "definitionCode"),
                });
        }

        bookingConflict = ValidateBookingsWithinCapacity(destination);
        if (bookingConflict is not null) return bookingConflict;
        var mode = ReadString(body, "mode") ?? "move-only";
        var overrides = ReadOverrides(body["capacityOverrides"]);
        var destinationId = ReadString(destination, "id")!;
        var destinationCapacity = ResolveDestinationCapacity(destination, sourceReserved, mode, overrides.GetValueOrDefault(destinationId));
        var capacityConflict = ValidateCapacity(destinationCapacity, JsonValue.Create(destinationCapacity));
        if (capacityConflict is not null) return capacityConflict;
        var destinationReserved = ReadInt(destination, "reserved") ?? 0;
        var freeSeats = destinationCapacity - destinationReserved;
        if (freeSeats < sourceReserved)
        {
            return ConflictEnvelope(
                "RESERVATIONS_OVER_DESTINATION_CAPACITY",
                "لجنة اليوم المستهدف ليس بها سعة كافية لاستيعاب الحجوزات.",
                new JsonObject
                {
                    ["conflicts"] = new JsonArray
                    {
                        TransferConflict(source, destination, destinationCapacity, freeSeats, sourceReserved),
                    },
                });
        }

        return Ok(await ApplyTransferPlan(
            ReadString(source, "cycleId") ?? "",
            sourceDate,
            [new PlannedTransfer(id, destinationId, sourceReserved, destinationCapacity)],
            ct,
            removeSourceRows: true));
    }

    private async Task<object> ApplyTransferPlan(
        string cycleId,
        string fromDate,
        List<PlannedTransfer> plan,
        CancellationToken ct,
        bool removeSourceRows = false)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var bumped = 0;
        var transferred = 0;
        var totalReservationsMoved = 0;

        foreach (var transfer in plan)
        {
            var source = await Get(transfer.SourceId, ct);
            var destination = await Get(transfer.DestinationId, ct);
            if (source is null || destination is null) continue;

            var previousCapacity = ReadInt(destination, "capacity") ?? 0;
            if (previousCapacity != transfer.DestinationCapacity)
            {
                destination["capacity"] = transfer.DestinationCapacity;
                bumped++;
            }
            destination["reserved"] = (ReadInt(destination, "reserved") ?? 0) + transfer.ReservedToMove;
            destination["updatedAt"] = now;
            await Upsert(transfer.DestinationId, destination, ct);

            source["reserved"] = 0;
            source["updatedAt"] = now;
            await Upsert(transfer.SourceId, source, ct);

            transferred++;
            totalReservationsMoved += transfer.ReservedToMove;
        }

        if (plan.Count > 0)
        {
            var rows = await Bucket(ct);
            var hasRemaining = rows.Any(x =>
                ReadString(x, "cycleId") == cycleId &&
                ReadString(x, "date") == fromDate &&
                (ReadInt(x, "reserved") ?? 0) > 0);
            if (!hasRemaining)
            {
                var sourceRows = rows
                    .Where(x => ReadString(x, "cycleId") == cycleId && ReadString(x, "date") == fromDate)
                    .ToList();
                foreach (var row in sourceRows)
                {
                    var itemId = ReadString(row, "id");
                    if (itemId is null) continue;
                    if (removeSourceRows && !plan.Any(x => x.SourceId == itemId)) continue;
                    var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == BucketName && x.Id == itemId, ct);
                    if (item is not null) db.Items.Remove(item);
                }
                await db.SaveChangesAsync(ct);
            }
        }

        return new { transferred, createdAtDestination = 0, bumped, totalReservationsMoved };
    }

    private async Task<List<JsonObject>> Bucket(CancellationToken ct)
        => (await db.Items.AsNoTracking()
            .Where(x => x.Bucket == BucketName)
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task<JsonObject?> Get(string id, CancellationToken ct)
        => await db.Items.AsNoTracking()
            .Where(x => x.Bucket == BucketName && x.Id == id)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(ct) is { } payload ? Parse(payload) : null;

    private async Task Upsert(string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == BucketName && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == BucketName).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create(BucketName, id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else
        {
            item.ReplacePayload(payload.ToJsonString(JsonOptions));
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task<int> NextSerial(CancellationToken ct)
    {
        var max = await db.Items
            .Where(x => x.Bucket == BucketName && x.Id.StartsWith("CIN-"))
            .Select(x => x.Id)
            .ToListAsync(ct);
        var next = max
            .Select(x => int.TryParse(x.Replace("CIN-", "", StringComparison.Ordinal), out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max() + 1;
        return next;
    }

    private static JsonObject TransferConflict(
        JsonObject source,
        JsonObject destination,
        int destinationCapacity,
        int freeSeats,
        int reservedToMove)
    {
        var destinationReserved = ReadInt(destination, "reserved") ?? 0;
        return new JsonObject
        {
            ["committeeName"] = ReadString(source, "definitionCode"),
            ["categoryKey"] = ReadString(source, "categoryKey"),
            ["sourceInstanceId"] = ReadString(source, "id"),
            ["destinationInstanceId"] = ReadString(destination, "id"),
            ["sourceReserved"] = reservedToMove,
            ["destinationCapacity"] = destinationCapacity,
            ["destinationReserved"] = destinationReserved,
            ["freeSeats"] = Math.Max(0, freeSeats),
            ["requiredCapacity"] = destinationReserved + reservedToMove,
        };
    }

    private static bool SameCommitteeSet(List<JsonObject> source, List<JsonObject> destination)
    {
        var sourceKeys = source.Select(CommitteeSetKey).Order(StringComparer.Ordinal).ToList();
        var destinationKeys = destination.Select(CommitteeSetKey).Order(StringComparer.Ordinal).ToList();
        return sourceKeys.Count > 0 &&
            sourceKeys.Count == destinationKeys.Count &&
            sourceKeys.SequenceEqual(destinationKeys, StringComparer.Ordinal);
    }

    private static string CommitteeSetKey(JsonObject row)
        => $"{ReadString(row, "categoryKey")}|{ReadString(row, "definitionCode")}";

    private static Dictionary<string, int> ReadOverrides(JsonNode? node)
    {
        var output = new Dictionary<string, int>(StringComparer.Ordinal);
        if (node is not JsonObject obj) return output;
        foreach (var (key, value) in obj)
        {
            if (value is null) continue;
            try
            {
                var capacity = value.GetValue<int>();
                output[key] = capacity;
            }
            catch
            {
                output[key] = 0;
            }
        }
        return output;
    }

    private static int ResolveDestinationCapacity(JsonObject destination, int reservedToMove, string mode, int overrideCapacity)
    {
        if (overrideCapacity > 0) return overrideCapacity;
        var capacity = ReadInt(destination, "capacity") ?? 0;
        return mode == "move-and-add-capacity" ? capacity + reservedToMove : capacity;
    }

    private static IActionResult? ValidateCapacity(int? capacity, JsonNode? raw)
        => capacity is null or < 1 or > 999
            ? ConflictEnvelope(
                "CAPACITY_NOT_POSITIVE",
                "السعة يجب أن تكون عدداً صحيحاً بين 1 و 999",
                new JsonObject { ["capacity"] = raw?.DeepClone() })
            : null;

    private static IActionResult? ValidateEditableDay(string date)
        => date.Length > 0 && string.CompareOrdinal(date, TodayIsoLocal()) < 0
            ? ConflictEnvelope(
                "COMMITTEE_INSTANCE_DAY_PASSED",
                "لا يمكن تعديل أو حذف موعد يوم سابق.",
                new JsonObject { ["date"] = date })
            : null;

    private static IActionResult? ValidateNoBookings(JsonObject row)
    {
        var reserved = ReadInt(row, "reserved") ?? 0;
        return reserved > 0
            ? ConflictEnvelope(
                "COMMITTEE_INSTANCE_HAS_BOOKINGS",
                "لا يمكن حذف لجنة لها حجوزات قائمة.",
                new JsonObject { ["id"] = ReadString(row, "id"), ["reserved"] = reserved })
            : null;
    }

    private static IActionResult? ValidateBookingsWithinCapacity(JsonObject row)
    {
        var reserved = ReadInt(row, "reserved") ?? 0;
        var capacity = ReadInt(row, "capacity") ?? 0;
        return reserved > capacity
            ? ConflictEnvelope(
                "COMMITTEE_INSTANCE_BOOKINGS_OVER_CAPACITY",
                "عدد الحجوزات يجب ألا يتجاوز سعة اللجنة.",
                new JsonObject
                {
                    ["id"] = ReadString(row, "id"),
                    ["reserved"] = reserved,
                    ["capacity"] = capacity,
                })
            : null;
    }

    private static ObjectResult ConflictEnvelope(string conflictCode, string message, JsonObject? extra = null)
    {
        var payload = extra?.DeepClone().AsObject() ?? new JsonObject();
        payload["code"] = "CONFLICT";
        payload["conflictCode"] = conflictCode;
        payload["message"] = message;
        return new ObjectResult(payload) { StatusCode = StatusCodes.Status409Conflict };
    }

    private static string UniqueKey(JsonObject row)
        => UniqueKey(ReadString(row, "cycleId") ?? "", ReadString(row, "definitionCode") ?? "", ReadString(row, "date") ?? "");

    private static string UniqueKey(string cycleId, string definitionCode, string date)
        => $"{cycleId}|{definitionCode}|{date}";

    private static JsonObject Parse(string payload)
        => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();

    private static string? ReadString(JsonObject? obj, string property)
        => obj is not null && obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;

    private static int? ReadInt(JsonObject obj, string property)
    {
        if (!obj.TryGetPropertyValue(property, out var value) || value is null) return null;
        try { return value.GetValue<int>(); }
        catch { return null; }
    }

    private static string TodayIsoLocal()
    {
        var today = DateTime.Today;
        return $"{today.Year:0000}-{today.Month:00}-{today.Day:00}";
    }

    private sealed record PlannedTransfer(
        string SourceId,
        string DestinationId,
        int ReservedToMove,
        int DestinationCapacity);

    private const string BucketName = "committeeInstances";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };
}
