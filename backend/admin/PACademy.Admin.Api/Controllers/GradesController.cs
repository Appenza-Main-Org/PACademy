using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;
using System.Xml.Linq;
using Microsoft.AspNetCore.Mvc;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class GradesController(AdminRecordsService records) : ControllerBase
{
    private const int ImportCommitBatchSize = 5000;
    private const int PreflightFailureSampleLimit = 1000;

    [HttpGet("api/grades")]
    public async Task<ActionResult<object>> List([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] int? size, CancellationToken ct)
    {
        var allRows = (await records.ListAsync("grades", ct)).ToList();
        var rows = FilterRows(allRows);
        if (page is not null || pageSize is not null || size is not null)
        {
            var p = page.GetValueOrDefault(1);
            var ps = pageSize ?? size ?? 25;
            return Ok(new
            {
                rows = rows.Skip(Math.Max(0, p - 1) * ps).Take(ps).ToList(),
                total = rows.Count,
                summary = BuildSummary(allRows),
                facets = BuildFacets(allRows)
            });
        }
        return Ok(rows);
    }

    [HttpGet("api/grades/export")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Export(CancellationToken ct)
    {
        var allRows = (await records.ListAsync("grades", ct)).ToList();
        return Ok(FilterRows(allRows));
    }

    [HttpGet("api/admin/applicant-grades/by-nid/{nid}")]
    public async Task<ActionResult<JsonObject>> ByNationalId(string nid, CancellationToken ct)
    {
        var row = (await records.ListAsync("grades", ct)).FirstOrDefault(x => AdminRecordJson.StringProp(x, "nid") == nid);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("api/grades")]
    public async Task<ActionResult<object>> Delete([FromBody] JsonObject? body, CancellationToken ct)
    {
        var seats = body?["seats"]?.AsArray().Select(x => x?.GetValue<int>()).Where(x => x is not null).Select(x => x!.Value).ToHashSet();
        if (seats is not { Count: > 0 })
        {
            return Ok(new { deleted = await records.DeleteModuleAsync("grades", ct) });
        }

        var rows = await records.ListAsync("grades", ct);
        var targetIds = rows
            .Where(x => seats.Contains((int)(AdminRecordJson.NumberProp(x, "seat") ?? -1)))
            .Select(x => AdminRecordJson.StringProp(x, "id") ?? AdminRecordJson.StringProp(x, "seat") ?? "")
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        return Ok(new { deleted = await records.DeleteManyAsync("grades", targetIds, ct) });
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
        var failureCount = 0;
        foreach (var row in inputRows.OfType<JsonObject>())
        {
            var missing = string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "nationalId")) ||
                          string.IsNullOrWhiteSpace(AdminRecordJson.StringProp(row, "nameAr")) ||
                          row["totalGrade"] is null;
            if (missing)
            {
                failureCount++;
                if (failures.Count >= PreflightFailureSampleLimit) continue;
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
                imported = inputRows.Count - failureCount,
                skipped = 0,
                failed = failureCount
            },
            groups = failureCount == 0
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
        var selectedCategories = body["selectedSchoolCategories"]?.AsArray()
            .Select(x => x?.GetValue<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var (existingNids, nextSeatValue) = await records.GradesImportIndexAsync(ct);
        var inserted = 0;
        var failed = 0;
        var alreadyImported = 0;
        var nextSeat = nextSeatValue;
        var batch = new List<JsonObject>(ImportCommitBatchSize);

        async Task FlushBatchAsync()
        {
            if (batch.Count == 0) return;
            await records.InsertManyAsync("grades", batch, ct, ImportCommitBatchSize);
            inserted += batch.Count;
            batch.Clear();
        }

        foreach (var row in inputRows.OfType<JsonObject>())
        {
            var nid = AdminRecordJson.StringProp(row, "nationalId");
            var name = AdminRecordJson.StringProp(row, "nameAr");
            var total = row["totalGrade"]?.GetValue<double?>();
            if (string.IsNullOrWhiteSpace(nid) || string.IsNullOrWhiteSpace(name) || total is null)
            {
                failed++;
                continue;
            }
            var schoolCategoryCode = ResolveImportSchoolCategoryCode(
                AdminRecordJson.StringProp(row, "schoolCategory"),
                selectedCategories);
            if (schoolCategoryCode is null)
            {
                failed++;
                continue;
            }
            if (existingNids.Contains(nid))
            {
                alreadyImported++;
                continue;
            }
            var seat = nextSeat++;
            if (row["maxGrade"] is null && MaxGradeForRow(row, body) is double maxGrade)
            {
                row["maxGrade"] = maxGrade;
            }
            var grade = GradeFromImportRow(row, seat, nid, name, total.Value, graduationYear, schoolCategoryCode);
            batch.Add(grade);
            existingNids.Add(nid);
            if (batch.Count >= ImportCommitBatchSize) await FlushBatchAsync();
        }

        await FlushBatchAsync();
        if (inserted > 0)
        {
            await records.AddBulkAuditRecordAsync(
                "grades",
                "bulk_import",
                $"grades-import-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}",
                $"grades.bulk_import · inserted={inserted}, failed={failed}, alreadyImported={alreadyImported}",
                ct);
        }

        return Ok(new { insertedCount = inserted, failedCount = failed, alreadyImportedCount = alreadyImported });
    }

    [HttpPost("api/grades/import/file")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<object>> ImportFile([FromForm] IFormFile file, [FromForm] int? graduationYear, [FromForm] string? duplicateAction, CancellationToken ct)
    {
        if (file.Length == 0) throw new ConflictException("FILE_EMPTY", "ملف الدرجات فارغ");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var maxBytes = extension switch
        {
            ".csv" => 5 * 1024 * 1024,
            ".xlsx" => 10 * 1024 * 1024,
            ".xls" => 10 * 1024 * 1024,
            ".mdb" => 20 * 1024 * 1024,
            ".accdb" => 20 * 1024 * 1024,
            _ => throw new ConflictException("UNSUPPORTED_FILE_TYPE", "صيغة ملف الدرجات غير مدعومة")
        };
        if (file.Length > maxBytes) throw new ConflictException("FILE_TOO_LARGE", "حجم ملف الدرجات يتجاوز الحد المسموح");

        await using var stream = file.OpenReadStream();
        var rows = extension switch
        {
            ".csv" => await ParseCsvAsync(stream, ct),
            ".xlsx" => ParseXlsx(stream),
            ".xls" => await ParseCsvAsync(stream, ct),
            ".mdb" or ".accdb" => await ParseCsvAsync(stream, ct),
            _ => []
        };
        var body = new JsonObject
        {
            ["rows"] = new JsonArray(rows.Select(x => (JsonNode)x).ToArray()),
            ["graduationYear"] = graduationYear ?? DateTimeOffset.UtcNow.Year,
            ["duplicateAction"] = duplicateAction ?? "keep"
        };
        return await CommitImport(body, ct);
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

    private List<JsonObject> FilterRows(List<JsonObject> rows)
    {
        var q = Request.Query["q"].ToString();
        if (!string.IsNullOrWhiteSpace(q))
        {
            rows = rows.Where(x =>
                (AdminRecordJson.StringProp(x, "nid") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (AdminRecordJson.StringProp(x, "name") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (AdminRecordJson.StringProp(x, "seatingNumber") ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        rows = FilterByText(rows, "gender", "gender", exact: true);
        rows = FilterByText(rows, "branch", "branch", exact: true);
        var schoolCategoryCode = Request.Query["schoolCategoryCode"].ToString();
        if (!string.IsNullOrWhiteSpace(schoolCategoryCode))
        {
            rows = rows.Where(x => string.Equals(GradeSchoolCategoryCode(x), schoolCategoryCode, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        rows = FilterByText(rows, "nid", "nid", exact: false);
        rows = FilterByText(rows, "seatingNumber", "seatingNumber", exact: false);
        rows = FilterByText(rows, "name", "name", exact: false);
        rows = FilterByText(rows, "school", "school", exact: false);

        var schoolCategoryCodes = QueryValues("schoolCategoryCodes");
        if (schoolCategoryCodes.Count > 0)
        {
            rows = rows.Where(x => schoolCategoryCodes.Contains(GradeSchoolCategoryCode(x) ?? "")).ToList();
        }

        if (QueryNumber("year") is double year)
        {
            rows = rows.Where(x => AdminRecordJson.NumberProp(x, "graduationYear") == year).ToList();
        }

        rows = FilterByNumberRange(rows, x => AdminRecordJson.NumberProp(x, "total"), "totalMin", "totalMax");
        rows = FilterByNumberRange(rows, GradePercentage, "pctMin", "pctMax");
        rows = FilterByNumberRange(rows, EffectiveGrade, "effMin", "effMax");
        rows = FilterByNumberRange(rows, x => AdminRecordJson.NumberProp(x, "graduationYear"), "graduationYearMin", "graduationYearMax");

        var changedOnly = bool.TryParse(Request.Query["changedOnly"], out var changed) && changed;
        if (changedOnly) rows = rows.Where(x => x["gradeChangedAt"] is not null || (x["log"]?.AsArray().Count ?? 0) > 0).ToList();

        return SortRows(rows);
    }

    private static object BuildSummary(IReadOnlyList<JsonObject> rows) => new
    {
        total = rows.Count,
        general = rows.Count(x => AdminRecordJson.StringProp(x, "kind") == "general"),
        azhar = rows.Count(x => AdminRecordJson.StringProp(x, "kind") == "azhar"),
        withAdjustments = rows.Count(x => x["gradeChangedAt"] is not null || (x["log"]?.AsArray().Count ?? 0) > 0)
    };

    private static object BuildFacets(IReadOnlyList<JsonObject> rows) => new
    {
        branches = rows
            .Select(x => AdminRecordJson.StringProp(x, "branch"))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList()
    };

    private List<JsonObject> FilterByText(List<JsonObject> rows, string queryKey, string property, bool exact)
    {
        var value = Request.Query[queryKey].ToString();
        if (string.IsNullOrWhiteSpace(value)) return rows;
        return rows.Where(x =>
        {
            var rowValue = AdminRecordJson.StringProp(x, property) ?? "";
            return exact
                ? string.Equals(rowValue, value, StringComparison.OrdinalIgnoreCase)
                : rowValue.Contains(value, StringComparison.OrdinalIgnoreCase);
        }).ToList();
    }

    private List<JsonObject> FilterByNumberRange(
        List<JsonObject> rows,
        Func<JsonObject, double?> getValue,
        string minKey,
        string maxKey)
    {
        var min = QueryNumber(minKey);
        var max = QueryNumber(maxKey);
        if (min is null && max is null) return rows;
        return rows.Where(x =>
        {
            var value = getValue(x);
            if (value is null) return false;
            return (min is null || value >= min) && (max is null || value <= max);
        }).ToList();
    }

    private List<string> QueryValues(string key) =>
        Request.Query[key]
            .SelectMany(value => value?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private double? QueryNumber(string key)
    {
        var value = Request.Query[key].ToString();
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ||
               double.TryParse(value, NumberStyles.Float, CultureInfo.GetCultureInfo("ar-EG"), out number)
            ? number
            : null;
    }

    private static double GradeMax(JsonObject row) =>
        AdminRecordJson.NumberProp(row, "overrideMax") ??
        AdminRecordJson.NumberProp(row, "importMax") ??
        410;

    private static double ActiveAdjustmentSum(JsonObject row)
    {
        var log = row["log"]?.AsArray();
        if (log is null) return 0;
        var sum = 0d;
        foreach (var item in log.OfType<JsonObject>())
        {
            var isActive = item["isActive"]?.GetValue<bool?>() ?? true;
            if (isActive) sum += AdminRecordJson.NumberProp(item, "amount") ?? 0;
        }
        return sum;
    }

    private static double? GradePercentage(JsonObject row)
    {
        var total = AdminRecordJson.NumberProp(row, "total");
        var max = GradeMax(row);
        if (total is null || max <= 0) return null;
        return Math.Round((total.Value / max) * 100, 2);
    }

    private static double? EffectiveGrade(JsonObject row)
    {
        var total = AdminRecordJson.NumberProp(row, "total");
        if (total is null) return null;
        var max = GradeMax(row);
        return Math.Max(0, Math.Min(max, total.Value + ActiveAdjustmentSum(row)));
    }

    private List<JsonObject> SortRows(List<JsonObject> rows)
    {
        var key = Request.Query["sortKey"].ToString();
        var descending = string.Equals(Request.Query["sortDirection"].ToString(), "desc", StringComparison.OrdinalIgnoreCase);

        return key switch
        {
            "nid" => SortString(rows, x => AdminRecordJson.StringProp(x, "nid"), descending),
            "seatingNumber" => SortString(rows, x => AdminRecordJson.StringProp(x, "seatingNumber"), descending),
            "name" => SortString(rows, x => AdminRecordJson.StringProp(x, "name"), descending),
            "kind" => SortString(rows, x => AdminRecordJson.StringProp(x, "kind"), descending),
            "gender" => SortString(rows, x => AdminRecordJson.StringProp(x, "gender"), descending),
            "branch" => SortString(rows, x => AdminRecordJson.StringProp(x, "branch"), descending),
            "schoolCategoryCode" => SortString(rows, GradeSchoolCategoryCode, descending),
            "school" => SortString(rows, x => AdminRecordJson.StringProp(x, "school"), descending),
            "region" => SortString(rows, x => AdminRecordJson.StringProp(x, "region"), descending),
            "examRound" => SortString(rows, x => AdminRecordJson.StringProp(x, "examRound"), descending),
            "graduationYear" => SortNumber(rows, x => AdminRecordJson.NumberProp(x, "graduationYear"), descending),
            "total" => SortNumber(rows, x => AdminRecordJson.NumberProp(x, "total"), descending),
            "max" => SortNumber(rows, x => GradeMax(x), descending),
            "pct" => SortNumber(rows, GradePercentage, descending),
            "eff" => SortNumber(rows, EffectiveGrade, descending),
            "effPct" => SortNumber(rows, x =>
            {
                var eff = EffectiveGrade(x);
                var max = GradeMax(x);
                return eff is null || max <= 0 ? null : Math.Round((eff.Value / max) * 100, 2);
            }, descending),
            _ => SortNumber(rows, x => AdminRecordJson.NumberProp(x, "seat"), descending: false)
        };
    }

    private static List<JsonObject> SortString(List<JsonObject> rows, Func<JsonObject, string?> getValue, bool descending) =>
        descending
            ? rows.OrderByDescending(x => getValue(x) ?? "", StringComparer.Ordinal).ThenBy(x => AdminRecordJson.NumberProp(x, "seat") ?? 0).ToList()
            : rows.OrderBy(x => getValue(x) ?? "", StringComparer.Ordinal).ThenBy(x => AdminRecordJson.NumberProp(x, "seat") ?? 0).ToList();

    private static List<JsonObject> SortNumber(List<JsonObject> rows, Func<JsonObject, double?> getValue, bool descending) =>
        descending
            ? rows.OrderByDescending(x => getValue(x) ?? double.MinValue).ThenBy(x => AdminRecordJson.NumberProp(x, "seat") ?? 0).ToList()
            : rows.OrderBy(x => getValue(x) ?? double.MaxValue).ThenBy(x => AdminRecordJson.NumberProp(x, "seat") ?? 0).ToList();

    private async Task<JsonObject> GetGradeBySeat(string seat, CancellationToken ct)
    {
        var row = await records.GetAsync("grades", seat, ct);
        if (row is not null) return row;
        throw new KeyNotFoundException("درجة الطالب غير موجودة");
    }

    private static JsonObject GradeFromImportRow(
        JsonObject row,
        int seat,
        string nid,
        string name,
        double total,
        int graduationYear,
        string? schoolCategoryCode = null) => new()
    {
        ["id"] = seat.ToString(),
        ["seat"] = seat,
        ["seatingNumber"] = AdminRecordJson.StringProp(row, "seatingNumber") ?? seat.ToString(),
        ["nid"] = nid,
        ["name"] = name,
        ["kind"] = KindFromSchoolCategoryCode(schoolCategoryCode ?? AdminRecordJson.StringProp(row, "schoolCategory")),
        ["gender"] = "male",
        ["branch"] = AdminRecordJson.StringProp(row, "track") ?? "",
        ["graduationYear"] = graduationYear,
        ["schoolCategoryCode"] = schoolCategoryCode ?? AdminRecordJson.StringProp(row, "schoolCategory"),
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

    private static string KindFromSchoolCategoryCode(string? code) =>
        string.Equals(code, "SCH-03", StringComparison.OrdinalIgnoreCase) ? "azhar" : "general";

    private static string? ResolveImportSchoolCategoryCode(string? value, IReadOnlyCollection<string> selectedCategories)
    {
        if (!string.IsNullOrWhiteSpace(value) && selectedCategories.Contains(value, StringComparer.OrdinalIgnoreCase))
        {
            return selectedCategories.First(x => string.Equals(x, value, StringComparison.OrdinalIgnoreCase));
        }
        if (selectedCategories.Count == 1)
        {
            return selectedCategories.First();
        }
        return null;
    }

    private static string? GradeSchoolCategoryCode(JsonObject row)
    {
        var code = AdminRecordJson.StringProp(row, "schoolCategoryCode") ?? AdminRecordJson.StringProp(row, "schoolCategory");
        if (!string.IsNullOrWhiteSpace(code)) return code;
        return AdminRecordJson.StringProp(row, "kind") switch
        {
            "azhar" => "SCH-03",
            "general" => "SCH-01",
            _ => null
        };
    }

    private static double? MaxGradeForRow(JsonObject row, JsonObject body)
    {
        var category = AdminRecordJson.StringProp(row, "schoolCategory");
        if (string.IsNullOrWhiteSpace(category)) return null;
        if (body["maxGradeByCategory"] is not JsonObject maxByCategory) return null;
        return maxByCategory[category]?.GetValue<double?>();
    }

    private static async Task<IReadOnlyList<JsonObject>> ParseCsvAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);
        var text = await reader.ReadToEndAsync(ct);
        return RowsFromTable(ParseDelimited(text));
    }

    private static IReadOnlyList<JsonObject> ParseXlsx(Stream stream)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
        var sharedStrings = ReadSharedStrings(archive);
        var sheet = archive.GetEntry("xl/worksheets/sheet1.xml")
            ?? archive.Entries.FirstOrDefault(x => x.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase));
        if (sheet is null) throw new ConflictException("FILE_PARSE_FAILED", "لا توجد ورقة بيانات قابلة للقراءة في ملف Excel");
        using var sheetStream = sheet.Open();
        var doc = XDocument.Load(sheetStream);
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var table = new List<List<string>>();
        foreach (var row in doc.Descendants(ns + "row"))
        {
            var values = new SortedDictionary<int, string>();
            foreach (var cell in row.Elements(ns + "c"))
            {
                var reference = cell.Attribute("r")?.Value ?? "";
                var index = ColumnIndex(reference);
                var raw = cell.Element(ns + "v")?.Value ?? cell.Element(ns + "is")?.Element(ns + "t")?.Value ?? "";
                var type = cell.Attribute("t")?.Value;
                values[index] = type == "s" && int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var sharedIndex) && sharedIndex < sharedStrings.Count
                    ? sharedStrings[sharedIndex]
                    : raw;
            }
            if (values.Count > 0) table.Add(Enumerable.Range(0, values.Keys.Max() + 1).Select(i => values.GetValueOrDefault(i, "")).ToList());
        }
        return RowsFromTable(table);
    }

    private static IReadOnlyList<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null) return [];
        using var stream = entry.Open();
        var doc = XDocument.Load(stream);
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        return doc.Descendants(ns + "si").Select(si => string.Concat(si.Descendants(ns + "t").Select(t => t.Value))).ToList();
    }

    private static IReadOnlyList<JsonObject> RowsFromTable(IReadOnlyList<IReadOnlyList<string>> table)
    {
        if (table.Count < 2) return [];
        var headers = table[0].Select(NormalizeHeader).ToList();
        var rows = new List<JsonObject>();
        for (var i = 1; i < table.Count; i++)
        {
            var row = new JsonObject { ["sourceRowIndex"] = i + 1 };
            for (var c = 0; c < headers.Count && c < table[i].Count; c++)
            {
                var key = headers[c];
                if (key is null) continue;
                row[key] = table[i][c];
            }
            NormalizeGradeRow(row);
            rows.Add(row);
        }
        return rows;
    }

    private static List<List<string>> ParseDelimited(string text)
    {
        var delimiter = text.Contains('\t') ? '\t' : ',';
        var rows = new List<List<string>>();
        var current = new List<string>();
        var field = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (ch == '"')
            {
                if (quoted && i + 1 < text.Length && text[i + 1] == '"')
                {
                    field.Append('"');
                    i++;
                }
                else quoted = !quoted;
            }
            else if (ch == delimiter && !quoted)
            {
                current.Add(field.ToString());
                field.Clear();
            }
            else if ((ch == '\n' || ch == '\r') && !quoted)
            {
                if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                current.Add(field.ToString());
                field.Clear();
                if (current.Any(x => !string.IsNullOrWhiteSpace(x))) rows.Add(current);
                current = [];
            }
            else field.Append(ch);
        }
        current.Add(field.ToString());
        if (current.Any(x => !string.IsNullOrWhiteSpace(x))) rows.Add(current);
        return rows;
    }

    private static string? NormalizeHeader(string value)
    {
        var header = value.Trim().Replace(" ", "", StringComparison.Ordinal).ToLowerInvariant();
        return header switch
        {
            "nid" or "nationalid" or "national_id" or "رقمقومى" or "الرقمالقومي" => "nationalId",
            "name" or "namear" or "studentname" or "الاسم" or "اسمالطالب" => "nameAr",
            "total" or "totalgrade" or "grade" or "المجموع" or "الدرجة" => "totalGrade",
            "max" or "maxgrade" or "النهايةالعظمى" => "maxGrade",
            "seat" or "seatingnumber" or "رقمالجلوس" => "seatingNumber",
            "track" or "branch" or "الشعبة" => "track",
            "school" or "schoolname" or "المدرسة" => "schoolName",
            "region" or "regionname" or "المنطقة" => "regionName",
            _ => null
        };
    }

    private static void NormalizeGradeRow(JsonObject row)
    {
        foreach (var key in new[] { "totalGrade", "maxGrade" })
        {
            var text = row[key]?.GetValue<string>();
            if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ||
                double.TryParse(text, NumberStyles.Float, CultureInfo.GetCultureInfo("ar-EG"), out number))
            {
                row[key] = number;
            }
        }
    }

    private static int ColumnIndex(string reference)
    {
        var letters = new string(reference.TakeWhile(char.IsLetter).ToArray()).ToUpperInvariant();
        var index = 0;
        foreach (var ch in letters)
        {
            index = index * 26 + (ch - 'A' + 1);
        }
        return Math.Max(0, index - 1);
    }
}
