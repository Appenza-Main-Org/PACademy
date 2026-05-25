using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;
using System.Xml.Linq;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("")]
public sealed class GradesController(AdminRecordsService records, AdminDbContext db, IMemoryCache cache) : ControllerBase
{
    private const int ImportCommitBatchSize = 5000;
    private const int PreflightFailureSampleLimit = 1000;
    private const string GradesSummaryCacheKey = "grades:list:summary";
    private const string GradesFacetsCacheKey = "grades:list:facets";
    private static readonly TimeSpan GradesListCacheTtl = TimeSpan.FromMinutes(10);

    [HttpGet("api/grades")]
    public async Task<ActionResult<object>> List([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] int? size, CancellationToken ct)
    {
        if (page is not null || pageSize is not null || size is not null)
        {
            return await ListPageFastAsync(page.GetValueOrDefault(1), pageSize ?? size ?? 25, ct);
        }

        var allRows = (await records.ListAsync("grades", ct))
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .ToList();
        var rows = FilterRows(allRows);
        return Ok(rows);
    }

    private async Task<ActionResult<object>> ListPageFastAsync(int page, int pageSize, CancellationToken ct)
    {
        var sql = BuildGradesPageSql(page, pageSize);
        var entities = await db.AdminRecords
            .FromSqlRaw(sql.RowsSql, sql.Parameters.ToArray())
            .AsNoTracking()
            .ToListAsync(ct);
        var rows = entities.Select(EntityToJson).ToList();
        var summary = await BuildSummaryFastAsync(ct);
        var total = summary.total;
        if (sql.HasFilters)
        {
            total = page == 1 && rows.Count < pageSize
                ? rows.Count
                : await db.Database
                    .SqlQueryRaw<int>(sql.CountSql, sql.Parameters.ToArray())
                    .SingleAsync(ct);
        }
        return Ok(new
        {
            rows,
            total,
            summary,
            facets = await BuildFacetsFastAsync(ct)
        });
    }

    [HttpGet("api/grades/export")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Export(CancellationToken ct)
    {
        var allRows = (await records.ListAsync("grades", ct))
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .ToList();
        return Ok(FilterRows(allRows));
    }

    [HttpGet("api/admin/applicant-grades/by-nid/{nid}")]
    public async Task<ActionResult<JsonObject>> ByNationalId(string nid, CancellationToken ct)
    {
        var row = (await records.ListAsync("grades", ct))
            .FirstOrDefault(x =>
                AdminRecordJson.StringProp(x, "nid") == nid
                && !AdminRecordJson.IsSoftDeleted(x));
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("api/grades")]
    public Task<ActionResult<object>> Delete([FromBody] JsonObject? body, CancellationToken ct)
    {
        return DeleteCore(body, ct);
    }

    [HttpPost("api/grades/delete")]
    public Task<ActionResult<object>> DeleteViaPost([FromBody] JsonObject? body, CancellationToken ct)
    {
        return DeleteCore(body, ct);
    }

    [HttpPost("api/grades/clear")]
    public Task<ActionResult<object>> ClearViaPost(CancellationToken ct)
    {
        return DeleteCore(null, ct);
    }

    private async Task<ActionResult<object>> DeleteCore(JsonObject? body, CancellationToken ct)
    {
        var seats = body?["seats"]?.AsArray().Select(x => x?.GetValue<int>()).Where(x => x is not null).Select(x => x!.Value).ToHashSet();
        var deletedBy = Request.Headers["X-User-Id"].FirstOrDefault();
        var reason = AdminRecordJson.StringProp(body ?? [], "reason");
        int deleted;
        if (seats is not { Count: > 0 })
        {
            deleted = await records.SoftDeleteModuleAsync("grades", deletedBy, reason, ct);
            if (deleted > 0) InvalidateGradesListCache();
            return Ok(new { deleted });
        }

        var rows = await records.ListAsync("grades", ct);
        // Skip rows that are already tombstoned — admin actions shouldn't reprocess soft-deleted rows.
        var targetIds = rows
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .Where(x => seats.Contains((int)(AdminRecordJson.NumberProp(x, "seat") ?? -1)))
            .Select(x => AdminRecordJson.StringProp(x, "id") ?? AdminRecordJson.StringProp(x, "seat") ?? "")
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        deleted = await records.SoftDeleteManyAsync("grades", targetIds, deletedBy, reason, ct);
        if (deleted > 0) InvalidateGradesListCache();
        return Ok(new { deleted });
    }

    [HttpPost("api/grades/import/stage")]
    public async Task<ActionResult<object>> StageImport([FromBody] JsonObject body, CancellationToken ct)
    {
        var rows = body["rows"]?.AsArray() ?? [];
        var existing = await records.ListAsync("grades", ct);
        var existingNids = existing
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .Select(x => AdminRecordJson.StringProp(x, "nid"))
            .Where(x => x is not null)
            .ToHashSet();
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
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .Select(x => new { Nid = AdminRecordJson.StringProp(x, "nid"), Row = x })
            .Where(x => !string.IsNullOrWhiteSpace(x.Nid))
            .ToDictionary(x => x.Nid!, x => x.Row);
        var inserted = 0;
        var replaced = 0;
        var kept = 0;
        var skipped = new JsonArray();
        // `seat` max includes soft-deleted rows so we don't reissue a tombstoned seat id.
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
                    var updatedGrade = GradeFromImportRow(row, previousSeat, nid, name, total.Value, graduationYear);
                    updatedGrade["previousGrade"] = previous["total"]?.DeepClone();
                    await records.UpsertAsync("grades", previousSeat.ToString(), updatedGrade, ct);
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

        if (inserted > 0 || replaced > 0) InvalidateGradesListCache();
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
        var allowOutOfRangeGrades =
            body["perGroupActions"] is JsonObject actions &&
            string.Equals(
                actions["GRADE_OUT_OF_RANGE"]?.GetValue<string>(),
                "override",
                StringComparison.OrdinalIgnoreCase);
        var acceptedExistingNids = body["existingDiffDecisions"] is JsonObject existingDiffDecisions
            ? existingDiffDecisions
                .Where(kv => string.Equals(kv.Value?.GetValue<string>(), "accept", StringComparison.OrdinalIgnoreCase))
                .Select(kv => kv.Key)
                .ToHashSet(StringComparer.Ordinal)
            : new HashSet<string>(StringComparer.Ordinal);
        var (existingNids, nextSeatValue) = await records.GradesImportIndexAsync(ct);
        var existingByNid = (await records.ListAsync("grades", ct))
            .Where(x => !AdminRecordJson.IsSoftDeleted(x))
            .Select(x => new { Nid = AdminRecordJson.StringProp(x, "nid"), Row = x })
            .Where(x => !string.IsNullOrWhiteSpace(x.Nid))
            .ToDictionary(x => x.Nid!, x => x.Row, StringComparer.Ordinal);
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
            var maxGrade = row["maxGrade"]?.GetValue<double?>() ?? MaxGradeForRow(row, body);
            if (total.Value < 0 || (!allowOutOfRangeGrades && maxGrade is not null && total.Value > maxGrade.Value))
            {
                failed++;
                continue;
            }
            if (existingNids.Contains(nid))
            {
                if (acceptedExistingNids.Contains(nid) &&
                    existingByNid.TryGetValue(nid, out var previous) &&
                    total.Value > (AdminRecordJson.NumberProp(previous, "total") ?? double.NegativeInfinity))
                {
                    var previousSeat = (int)(AdminRecordJson.NumberProp(previous, "seat") ?? 0);
                    if (previousSeat <= 0)
                    {
                        failed++;
                        continue;
                    }
                    if (row["maxGrade"] is null && maxGrade is not null)
                    {
                        row["maxGrade"] = maxGrade;
                    }
                    var updatedGrade = GradeFromImportRow(row, previousSeat, nid, name, total.Value, graduationYear, schoolCategoryCode);
                    updatedGrade["previousGrade"] = previous["total"]?.DeepClone();
                    await records.UpsertAsync("grades", previousSeat.ToString(CultureInfo.InvariantCulture), updatedGrade, ct);
                    existingByNid[nid] = updatedGrade;
                    inserted++;
                    continue;
                }
                alreadyImported++;
                continue;
            }
            var seat = nextSeat++;
            if (row["maxGrade"] is null && maxGrade is not null)
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

        if (inserted > 0) InvalidateGradesListCache();
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
        var updated = await records.UpsertAsync("grades", seat, row, ct);
        InvalidateGradesListCache();
        return Ok(updated);
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
        var updated = await records.UpsertAsync("grades", seat, row, ct);
        InvalidateGradesListCache();
        return Ok(updated);
    }

    [HttpDelete("api/grades/{seat}/adjustments/{entryId}")]
    public async Task<ActionResult<JsonObject>> DeleteAdjustment(string seat, string entryId, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        var log = row["log"]?.AsArray() ?? [];
        row["log"] = new JsonArray(log.Where(x => x is JsonObject obj && AdminRecordJson.StringProp(obj, "id") != entryId).Select(x => x?.DeepClone()).ToArray());
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        var updated = await records.UpsertAsync("grades", seat, row, ct);
        InvalidateGradesListCache();
        return Ok(updated);
    }

    [HttpPatch("api/grades/{seat}/override-max")]
    public async Task<ActionResult<JsonObject>> OverrideMax(string seat, [FromBody] JsonObject body, CancellationToken ct)
    {
        var row = await GetGradeBySeat(seat, ct);
        row["overrideMax"] = body["overrideMax"]?.DeepClone();
        row["lastEditedBy"] = body["by"]?.DeepClone() ?? "system";
        row["lastEditedAt"] = DateTimeOffset.UtcNow.ToString("O");
        row["gradeChangedAt"] = DateTimeOffset.UtcNow.ToString("O");
        var updated = await records.UpsertAsync("grades", seat, row, ct);
        InvalidateGradesListCache();
        return Ok(updated);
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

    private sealed class GradesPageSql
    {
        public required string RowsSql { get; init; }
        public required string CountSql { get; init; }
        public required List<SqlParameter> Parameters { get; init; }
        public required bool HasFilters { get; init; }
    }

    private sealed class GradesSummaryRow
    {
        public int Total { get; init; }
        public int General { get; init; }
        public int Azhar { get; init; }
        public int WithAdjustments { get; init; }
    }

    private sealed class GradesSummaryPayload
    {
        public int total { get; init; }
        public int general { get; init; }
        public int azhar { get; init; }
        public int withAdjustments { get; init; }
    }

    private GradesPageSql BuildGradesPageSql(int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 10_000);
        var parameters = new List<SqlParameter>();
        // Soft-delete guard: never return tombstoned rows from the list endpoint.
        var where = new List<string>
        {
            "[a].[module] = @module",
            $"{JsonValue("deletedAt")} IS NULL"
        };
        var hasFilters = false;
        parameters.Add(new SqlParameter("@module", "grades"));

        string AddParam(object value)
        {
            var name = $"@p{parameters.Count}";
            parameters.Add(new SqlParameter(name, value));
            return name;
        }

        void AddStringFilter(string queryKey, string jsonProperty, bool exact)
        {
            var value = Request.Query[queryKey].ToString();
            if (string.IsNullOrWhiteSpace(value)) return;
            hasFilters = true;
            var param = AddParam(exact ? value : $"%{EscapeSqlLike(value)}%");
            var expr = JsonValue(jsonProperty);
            where.Add(exact
                ? $"{expr} = {param}"
                : $"COALESCE({expr}, N'') LIKE {param} ESCAPE N'\\'");
        }

        var q = Request.Query["q"].ToString();
        if (!string.IsNullOrWhiteSpace(q))
        {
            hasFilters = true;
            var param = AddParam($"%{EscapeSqlLike(q)}%");
            where.Add($"""
                (
                    COALESCE({JsonValue("nid")}, N'') LIKE {param} ESCAPE N'\'
                    OR COALESCE({JsonValue("name")}, N'') LIKE {param} ESCAPE N'\'
                    OR COALESCE({JsonValue("seatingNumber")}, N'') LIKE {param} ESCAPE N'\'
                )
                """);
        }

        AddStringFilter("gender", "gender", exact: true);
        AddStringFilter("branch", "branch", exact: true);
        AddStringFilter("nid", "nid", exact: false);
        AddStringFilter("seatingNumber", "seatingNumber", exact: false);
        AddStringFilter("name", "name", exact: false);
        AddStringFilter("school", "school", exact: false);

        var schoolCategoryCode = Request.Query["schoolCategoryCode"].ToString();
        if (!string.IsNullOrWhiteSpace(schoolCategoryCode))
        {
            hasFilters = true;
            where.Add($"{SchoolCategorySql()} = {AddParam(schoolCategoryCode)}");
        }

        var schoolCategoryCodes = QueryValues("schoolCategoryCodes");
        if (schoolCategoryCodes.Count > 0)
        {
            hasFilters = true;
            var inParams = schoolCategoryCodes.Select(AddParam);
            where.Add($"{SchoolCategorySql()} IN ({string.Join(", ", inParams)})");
        }

        if (QueryNumber("year") is double year)
        {
            hasFilters = true;
            where.Add($"{NumberValue("graduationYear")} = {AddParam(year)}");
        }

        AddNumberRange("total", "totalMin", "totalMax");
        AddNumberRange("pct", "pctMin", "pctMax");
        AddNumberRange("eff", "effMin", "effMax");
        AddNumberRange("graduationYear", "graduationYearMin", "graduationYearMax");

        var changedOnly = bool.TryParse(Request.Query["changedOnly"], out var changed) && changed;
        if (changedOnly)
        {
            hasFilters = true;
            where.Add($"({JsonValue("gradeChangedAt")} IS NOT NULL OR EXISTS (SELECT 1 FROM OPENJSON([a].[payload_json], '$.log')))");
        }

        void AddNumberRange(string field, string minKey, string maxKey)
        {
            var min = QueryNumber(minKey);
            var max = QueryNumber(maxKey);
            if (min is null && max is null) return;
            hasFilters = true;
            var expr = field switch
            {
                "pct" => PercentageSql(),
                "eff" => EffectiveGradeSql(),
                _ => NumberValue(field)
            };
            if (min is not null) where.Add($"{expr} >= {AddParam(min.Value)}");
            if (max is not null) where.Add($"{expr} <= {AddParam(max.Value)}");
        }

        var whereSql = string.Join("\nAND ", where);
        var orderSql = BuildOrderSql();
        var offsetParam = AddParam(Math.Max(0, page - 1) * pageSize);
        var pageSizeParam = AddParam(pageSize);
        var selectSql = """
            SELECT [a].[module], [a].[id], [a].[payload_json], [a].[created_at], [a].[updated_at], [a].[row_version]
            FROM [admin_v2].[admin_records] AS [a]
            """;
        return new GradesPageSql
        {
            RowsSql = $"""
                {selectSql}
                WHERE {whereSql}
                ORDER BY {orderSql}
                OFFSET {offsetParam} ROWS FETCH NEXT {pageSizeParam} ROWS ONLY
                """,
            CountSql = $"""
                SELECT COUNT(1) AS [Value]
                FROM [admin_v2].[admin_records] AS [a]
                WHERE {whereSql}
                """,
            Parameters = parameters,
            HasFilters = hasFilters
        };
    }

    private string BuildOrderSql()
    {
        var descending = string.Equals(Request.Query["sortDirection"].ToString(), "desc", StringComparison.OrdinalIgnoreCase);
        var direction = descending ? "DESC" : "ASC";
        var nullValue = descending ? "-1.7976931348623157E+308" : "1.7976931348623157E+308";
        var expr = Request.Query["sortKey"].ToString() switch
        {
            "nid" => JsonValue("nid"),
            "seatingNumber" => JsonValue("seatingNumber"),
            "name" => JsonValue("name"),
            "kind" => JsonValue("kind"),
            "gender" => JsonValue("gender"),
            "branch" => JsonValue("branch"),
            "schoolCategoryCode" => SchoolCategorySql(),
            "school" => JsonValue("school"),
            "region" => JsonValue("region"),
            "examRound" => JsonValue("examRound"),
            "graduationYear" => NumberValue("graduationYear"),
            "total" => NumberValue("total"),
            "max" => GradeMaxSql(),
            "pct" => PercentageSql(),
            "eff" => EffectiveGradeSql(),
            "effPct" => $"(({EffectiveGradeSql()}) / NULLIF(({GradeMaxSql()}), 0) * 100.0)",
            _ => "TRY_CONVERT(float, [a].[id])"
        };
        var isNumeric = expr.StartsWith("TRY_CONVERT", StringComparison.Ordinal) ||
            expr.StartsWith("COALESCE(TRY_CONVERT", StringComparison.Ordinal) ||
            expr.StartsWith("CASE", StringComparison.Ordinal) ||
            expr.StartsWith("((", StringComparison.Ordinal);
        var primary = isNumeric ? $"COALESCE(({expr}), {nullValue}) {direction}" : $"COALESCE({expr}, N'') {direction}";
        return $"{primary}, COALESCE(({NumberValue("seat")}), 0) ASC, [a].[id] ASC";
    }

    private async Task<GradesSummaryPayload> BuildSummaryFastAsync(CancellationToken ct)
    {
        if (cache.TryGetValue<GradesSummaryPayload>(GradesSummaryCacheKey, out var cachedSummary) && cachedSummary is not null)
        {
            return cachedSummary;
        }

#pragma warning disable EF1002
        var summary = await db.Database
            .SqlQueryRaw<GradesSummaryRow>($"""
                SELECT
                    COUNT(1) AS [Total],
                    COALESCE(SUM(CASE WHEN {JsonValue("kind")} = N'general' THEN 1 ELSE 0 END), 0) AS [General],
                    COALESCE(SUM(CASE WHEN {JsonValue("kind")} = N'azhar' THEN 1 ELSE 0 END), 0) AS [Azhar],
                    COALESCE(SUM(CASE WHEN {JsonValue("gradeChangedAt")} IS NOT NULL OR JSON_QUERY([a].[payload_json], '$.log') IS NOT NULL AND JSON_QUERY([a].[payload_json], '$.log') <> N'[]' THEN 1 ELSE 0 END), 0) AS [WithAdjustments]
                FROM [admin_v2].[admin_records] AS [a]
                WHERE [a].[module] = N'grades'
                  AND {JsonValue("deletedAt")} IS NULL
                """)
            .SingleAsync(ct);
#pragma warning restore EF1002
        var payload = new GradesSummaryPayload
        {
            total = summary.Total,
            general = summary.General,
            azhar = summary.Azhar,
            withAdjustments = summary.WithAdjustments
        };
        cache.Set(GradesSummaryCacheKey, payload, GradesListCacheTtl);
        return payload;
    }

    private async Task<object> BuildFacetsFastAsync(CancellationToken ct)
    {
        if (cache.TryGetValue<object>(GradesFacetsCacheKey, out var cachedFacets) && cachedFacets is not null)
        {
            return cachedFacets;
        }

#pragma warning disable EF1002
        var branches = await db.Database
            .SqlQueryRaw<string>($"""
                SELECT DISTINCT {JsonValue("branch")} AS [Value]
                FROM [admin_v2].[admin_records] AS [a]
                WHERE [a].[module] = N'grades'
                  AND {JsonValue("deletedAt")} IS NULL
                  AND {JsonValue("branch")} IS NOT NULL
                  AND {JsonValue("branch")} <> N''
                ORDER BY [Value]
                """)
            .ToListAsync(ct);
#pragma warning restore EF1002
        var facets = new { branches };
        cache.Set(GradesFacetsCacheKey, facets, GradesListCacheTtl);
        return facets;
    }

    private void InvalidateGradesListCache()
    {
        cache.Remove(GradesSummaryCacheKey);
        cache.Remove(GradesFacetsCacheKey);
    }

    private static JsonObject EntityToJson(AdminRecordEntity entity)
    {
        var obj = AdminRecordJson.Parse(entity.PayloadJson);
        obj["id"] ??= entity.Id;
        obj["createdAt"] ??= entity.CreatedAt;
        obj["updatedAt"] ??= entity.UpdatedAt;
        return obj;
    }

    private static string JsonValue(string property) => $"JSON_VALUE([a].[payload_json], '$.{property}')";
    private static string NumberValue(string property) => $"TRY_CONVERT(float, {JsonValue(property)})";
    private static string GradeMaxSql() => $"COALESCE(TRY_CONVERT(float, {JsonValue("overrideMax")}), TRY_CONVERT(float, {JsonValue("importMax")}), 410.0)";
    private static string AdjustmentSumSql() =>
        "COALESCE((SELECT SUM(CASE WHEN COALESCE(JSON_VALUE([adj].[value], '$.isActive'), N'true') = N'true' THEN COALESCE(TRY_CONVERT(float, JSON_VALUE([adj].[value], '$.amount')), 0.0) ELSE 0.0 END) FROM OPENJSON([a].[payload_json], '$.log') AS [adj]), 0.0)";
    private static string EffectiveGradeSql() =>
        $"CASE WHEN {NumberValue("total")} IS NULL THEN NULL ELSE (CASE WHEN {NumberValue("total")} + {AdjustmentSumSql()} < 0 THEN 0.0 WHEN {NumberValue("total")} + {AdjustmentSumSql()} > {GradeMaxSql()} THEN {GradeMaxSql()} ELSE {NumberValue("total")} + {AdjustmentSumSql()} END) END";
    private static string PercentageSql() =>
        $"CASE WHEN {NumberValue("total")} IS NULL OR {GradeMaxSql()} <= 0 THEN NULL ELSE ROUND(({NumberValue("total")} / {GradeMaxSql()}) * 100.0, 2) END";
    private static string SchoolCategorySql() =>
        $"COALESCE(NULLIF({JsonValue("schoolCategoryCode")}, N''), NULLIF({JsonValue("schoolCategory")}, N''), CASE {JsonValue("kind")} WHEN N'azhar' THEN N'SCH-03' WHEN N'general' THEN N'SCH-01' ELSE NULL END)";

    private static string EscapeSqlLike(string value) =>
        value
            .Replace(@"\", @"\\", StringComparison.Ordinal)
            .Replace("%", @"\%", StringComparison.Ordinal)
            .Replace("_", @"\_", StringComparison.Ordinal)
            .Replace("[", @"\[", StringComparison.Ordinal);

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
        if (row is null) throw new KeyNotFoundException("درجة الطالب غير موجودة");
        if (AdminRecordJson.IsSoftDeleted(row))
        {
            throw new ConflictException("GRADE_SOFT_DELETED", "لا يمكن تعديل سجل درجات محذوف");
        }
        return row;
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
