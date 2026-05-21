using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.LookupsAdmin.Infrastructure;
using PACademy.Modules.CyclesAdmin.Infrastructure;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/app-settings")]
public sealed class ApplicationSettingsController(CyclesAdminDbContext db, LookupsAdminDbContext lookupsDb) : ControllerBase
{
    [HttpGet("category-configs")]
    public async Task<IActionResult> Configs(CancellationToken ct)
        => Ok(await JoinedConfigs(ct));

    [HttpPatch("category-configs/{id}")]
    public async Task<IActionResult> PatchConfig([FromRoute] string id, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var row = await Get("applicantCategoryConfigs", id, ct);
        if (row is null) return NotFound();
        Merge(row, patch);
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert("applicantCategoryConfigs", id, row, ct);
        return Ok(row);
    }

    [HttpPost("category-configs/{id}/toggle-active")]
    public async Task<IActionResult> ToggleConfig([FromRoute] string id, CancellationToken ct)
    {
        var row = await Get("applicantCategoryConfigs", id, ct);
        if (row is null) return NotFound();
        row["isActive"] = !(ReadBool(row, "isActive") ?? true);
        row["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        await Upsert("applicantCategoryConfigs", id, row, ct);
        return Ok(row);
    }

    [HttpGet("category-configs/{configId}/specializations")]
    public async Task<IActionResult> Specs([FromRoute] string configId, CancellationToken ct)
    {
        var specs = await List("applicantCategorySpecializations", ct);
        var years = await List("applicantSpecializationYears", ct);
        var lookupSpecs = await Lookup("specializations", ct);
        return Ok(specs
            .Where(x => ReadString(x, "configId") == configId && ReadString(x, "specializationId") != "__default__")
            .Select(x => JoinSpec(x, years, lookupSpecs))
            .ToList());
    }

    [HttpGet("category-configs/{configId}/eligible-specializations")]
    public async Task<IActionResult> EligibleSpecs([FromRoute] string configId, CancellationToken ct)
    {
        var attached = (await List("applicantCategorySpecializations", ct))
            .Where(x => ReadString(x, "configId") == configId)
            .Select(x => ReadString(x, "specializationId"))
            .ToHashSet(StringComparer.Ordinal);
        return Ok((await Lookup("specializations", ct))
            .Where(x => ReadBool(x, "isActive") != false && !attached.Contains(ReadString(x, "code")))
            .ToList());
    }

    [HttpPost("category-configs/{configId}/specializations")]
    public async Task<IActionResult> AttachSpec([FromRoute] string configId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var specializationId = ReadString(body, "specializationId");
        if (string.IsNullOrWhiteSpace(specializationId)) return BadRequest();
        var existing = (await List("applicantCategorySpecializations", ct))
            .FirstOrDefault(x => ReadString(x, "configId") == configId && ReadString(x, "specializationId") == specializationId);
        if (existing is not null) return Ok(existing);
        var id = $"acs-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var row = new JsonObject { ["id"] = id, ["configId"] = configId, ["specializationId"] = specializationId, ["isActive"] = true };
        await Upsert("applicantCategorySpecializations", id, row, ct);
        return Ok(row);
    }

    [HttpDelete("specializations/{id}")]
    public async Task<IActionResult> DetachSpec([FromRoute] string id, CancellationToken ct)
    {
        await Delete("applicantCategorySpecializations", id, ct);
        foreach (var y in (await db.Items.Where(x => x.Bucket == "applicantSpecializationYears").ToListAsync(ct)))
        {
            if (ReadString(Parse(y.PayloadJson), "categorySpecializationId") == id) db.Items.Remove(y);
        }
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("specializations/{csId}/years")]
    public async Task<IActionResult> Years([FromRoute] string csId, CancellationToken ct)
        => Ok((await List("applicantSpecializationYears", ct))
            .Where(x => ReadString(x, "categorySpecializationId") == csId)
            .OrderByDescending(MaxGraduationYear)
            .ToList());

    [HttpPost("specializations/{csId}/years")]
    public async Task<IActionResult> CreateYear([FromRoute] string csId, [FromBody] JsonObject body, CancellationToken ct)
    {
        var id = $"asy-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        body["id"] = id;
        body["categorySpecializationId"] = csId;
        await Upsert("applicantSpecializationYears", id, body, ct);
        return Ok(body);
    }

    [HttpPatch("years/{id}")]
    public async Task<IActionResult> PatchYear([FromRoute] string id, [FromBody] JsonObject patch, CancellationToken ct)
    {
        var row = await Get("applicantSpecializationYears", id, ct);
        if (row is null) return NotFound();
        Merge(row, patch);
        await Upsert("applicantSpecializationYears", id, row, ct);
        return Ok(row);
    }

    [HttpDelete("years/{id}")]
    public async Task<IActionResult> DeleteYear([FromRoute] string id, CancellationToken ct)
    {
        await Delete("applicantSpecializationYears", id, ct);
        return NoContent();
    }

    [HttpPost("years/{id}/toggle-active")]
    public async Task<IActionResult> ToggleYear([FromRoute] string id, CancellationToken ct)
    {
        var row = await Get("applicantSpecializationYears", id, ct);
        if (row is null) return NotFound();
        row["isActive"] = !(ReadBool(row, "isActive") ?? true);
        await Upsert("applicantSpecializationYears", id, row, ct);
        return Ok(row);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var configs = await JoinedConfigs(ct);
        var specs = await List("applicantCategorySpecializations", ct);
        var years = await List("applicantSpecializationYears", ct);
        var specLookup = await Lookup("specializations", ct);
        return Ok(configs.Select(cfg =>
        {
            var cfgId = ReadString(cfg, "id");
            var childSpecs = specs.Where(s => ReadString(s, "configId") == cfgId).ToList();
            var groups = childSpecs.Select(s =>
            {
                var specId = ReadString(s, "specializationId");
                var lookup = specLookup.FirstOrDefault(x => ReadString(x, "code") == specId);
                return new JsonObject
                {
                    ["csId"] = ReadString(s, "id"),
                    ["nameAr"] = specId == "__default__" ? null : (ReadString(lookup, "name") ?? specId),
                    ["years"] = new JsonArray(years.Where(y => ReadString(y, "categorySpecializationId") == ReadString(s, "id")).Select(y => y.DeepClone()).ToArray()),
                };
            }).ToArray();
            return new JsonObject
            {
                ["config"] = cfg.DeepClone(),
                ["groups"] = new JsonArray(groups),
                ["gradingMode"] = "GRADES",
            };
        }).ToList());
    }

    [HttpGet("specializations/{csId}/grading-mode")]
    public IActionResult GradingMode() => Ok("GRADES");

    [HttpGet("specializations/{csId}/parent-category")]
    public async Task<IActionResult> ParentCategory([FromRoute] string csId, CancellationToken ct)
    {
        var spec = await Get("applicantCategorySpecializations", csId, ct);
        if (spec is null) return Ok(null);
        var cfg = await Get("applicantCategoryConfigs", ReadString(spec, "configId") ?? "", ct);
        if (cfg is null) return Ok(null);
        var cat = (await Lookup("applicant-categories", ct)).FirstOrDefault(x => ReadString(x, "code") == ReadString(cfg, "categoryId"));
        var scope = cat?["genderScope"]?.AsArray().Select(x => x?.GetValue<string>()).Where(x => x is not null).Cast<string>().ToList() ?? [];
        return Ok(new { code = ReadString(cfg, "categoryId"), lockedGender = scope.Count == 1 ? scope[0] : null });
    }

    [HttpPost("bulk-save")]
    public async Task<IActionResult> BulkSave([FromBody] JsonArray changes, CancellationToken ct)
    {
        var created = 0; var updated = 0; var deleted = 0;
        foreach (var node in changes)
        {
            if (node is not JsonObject change) continue;
            var kind = ReadString(change, "kind");
            var id = ReadString(change, "id");
            if (kind == "delete" && id is not null)
            {
                await Delete("applicantSpecializationYears", id, ct);
                deleted++;
                continue;
            }
            var row = change["row"]?.AsObject();
            if (row is null) continue;
            if (kind == "create")
            {
                var nextId = $"asy-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{created}";
                row["id"] = nextId;
                await Upsert("applicantSpecializationYears", nextId, row, ct);
                created++;
            }
            else if (id is not null)
            {
                row["id"] = id;
                await Upsert("applicantSpecializationYears", id, row, ct);
                updated++;
            }
        }
        return Ok(new { created, updated, deleted });
    }

    [HttpGet("rule-rows")]
    public async Task<IActionResult> RuleRows(CancellationToken ct)
        => Ok(await List("applicationRuleRows", ct));

    [HttpPut("rule-rows/{id}")]
    public async Task<IActionResult> UpsertRuleRow([FromRoute] string id, [FromBody] JsonObject body, CancellationToken ct)
    {
        var validationErrors = await ValidateRuleRowBody(id, body, ct);
        if (validationErrors.Count > 0)
        {
            return BadRequest(new { code = "VALIDATION_ERROR", errors = validationErrors, message = "بيانات شروط اللجنة غير مكتملة" });
        }
        body["id"] = id;
        if (ReadString(body, "workflowState") is null) body["workflowState"] = "local";
        body["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        if (await Get("applicationRuleRows", id, ct) is null)
        {
            body["createdAt"] = DateTimeOffset.UtcNow.ToString("O");
        }
        await Upsert("applicationRuleRows", id, body, ct);
        return Ok(body);
    }

    [HttpDelete("rule-rows/{id}")]
    public async Task<IActionResult> DeleteRuleRow([FromRoute] string id, CancellationToken ct)
    {
        if (await Get("applicationRuleRows", id, ct) is null) return NotFound(new { code = "NOT_FOUND", message = "شرط اللجنة غير موجود" });
        await Delete("applicationRuleRows", id, ct);
        return NoContent();
    }

    [HttpPost("rule-rows/{categoryCode}/approve")]
    public async Task<IActionResult> ApproveRuleRows([FromRoute] string categoryCode, CancellationToken ct)
    {
        var items = await db.Items
            .Where(x => x.Bucket == "applicationRuleRows")
            .ToListAsync(ct);
        var moved = 0;
        foreach (var item in items)
        {
            var payload = Parse(item.PayloadJson);
            var row = payload["row"] as JsonObject;
            if (ReadString(row, "categoryCode") != categoryCode) continue;
            if (ReadString(payload, "workflowState") == "approved") continue;
            payload["workflowState"] = "approved";
            payload["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            item.ReplacePayload(payload.ToJsonString(JsonOptions));
            moved++;
        }
        if (moved > 0) await db.SaveChangesAsync(ct);
        return Ok(new { moved });
    }

    private async Task<List<object>> ValidateRuleRowBody(string id, JsonObject body, CancellationToken ct)
    {
        var errors = new List<object>();
        void Add(string field, string code, string message) => errors.Add(new { field, code, message });

        var state = ReadString(body, "workflowState") ?? "local";
        if (state is not ("local" or "approved")) Add("workflowState", "INVALID_STATE", "حالة الشرط غير صحيحة");

        var row = body["row"] as JsonObject;
        if (row is null)
        {
            Add("row", "REQUIRED", "بيانات الشرط مطلوبة");
            return errors;
        }
        if (ReadString(row, "id") != id) Add("row.id", "ID_MISMATCH", "معرّف الشرط لا يطابق الرابط");
        var categoryCode = ReadString(row, "categoryCode");
        if (string.IsNullOrWhiteSpace(categoryCode)) Add("row.categoryCode", "REQUIRED", "فئة التقديم مطلوبة");

        var header = row["header"] as JsonObject;
        if (header is null)
        {
            Add("row.header", "REQUIRED", "نطاق التقديم مطلوب");
        }
        else
        {
            var start = ReadDate(header, "applicationStart");
            var end = ReadDate(header, "applicationEnd");
            var ageReference = ReadDate(header, "ageReferenceDate");
            if (start is null) Add("row.header.applicationStart", "REQUIRED", "بداية التقديم مطلوبة");
            if (end is null) Add("row.header.applicationEnd", "REQUIRED", "نهاية التقديم مطلوبة");
            if (ageReference is null) Add("row.header.ageReferenceDate", "REQUIRED", "تاريخ احتساب السن مطلوب");
            if (start is not null && end is not null && end < start) Add("row.header.applicationEnd", "INVALID_DATE_RANGE", "نهاية التقديم يجب أن تكون بعد البداية");
            if (start is not null && ageReference is not null && ageReference > start) Add("row.header.ageReferenceDate", "AGE_REFERENCE_AFTER_START", "تاريخ احتساب السن يجب ألا يتجاوز بداية التقديم");
            if (ReadArrayStrings(header, "maritalStatus").Count == 0) Add("row.header.maritalStatus", "REQUIRED", "الحالة الاجتماعية مطلوبة");
            if (ReadDecimal(header, "maxAge") is not { } maxAge || maxAge <= 0) Add("row.header.maxAge", "AGE_NOT_POSITIVE", "الحد الأقصى للسن يجب أن يكون أكبر من صفر");
        }

        var mode = ReadString(row, "excellenceMode") ?? "GRADES";
        if (mode is not ("GRADES" or "TAGDIR")) Add("row.excellenceMode", "INVALID_MODE", "معيار التمييز غير صحيح");
        await ValidateScoreOrGrade(row, mode, errors, Add, ct);

        var kind = ReadString(row, "kind");
        if (kind == "thanawi")
        {
            if (string.IsNullOrWhiteSpace(ReadString(row, "examRound"))) Add("row.examRound", "REQUIRED", "الدور مطلوب");
            if (string.IsNullOrWhiteSpace(ReadString(row, "committee"))) Add("row.committee", "REQUIRED", "اللجنة مطلوبة");
            if (ReadDecimal(row, "graduationYear") is not { } graduationYear || graduationYear <= 0) Add("row.graduationYear", "REQUIRED", "سنة التخرج مطلوبة");
            if (ReadArrayStrings(row, "schoolCategories").Count == 0) Add("row.schoolCategories", "REQUIRED", "فئة المدرسة مطلوبة");
        }
        else if (kind == "university")
        {
            if (string.IsNullOrWhiteSpace(ReadString(row, "facultyCode"))) Add("row.facultyCode", "REQUIRED", "الكلية مطلوبة");
            if (string.IsNullOrWhiteSpace(ReadString(row, "specializationCode"))) Add("row.specializationCode", "REQUIRED", "التخصص مطلوب");
            if (ReadArrayStrings(row, "type").Count == 0) Add("row.type", "REQUIRED", "النوع مطلوب");
            if (ReadArrayStrings(row, "academicDegrees").Count == 0) Add("row.academicDegrees", "REQUIRED", "الدرجة العلمية مطلوبة");
            if (ReadArrayStrings(row, "committees").Count == 0) Add("row.committees", "REQUIRED", "اللجنة مطلوبة");
            if (ReadArrayNumbers(row, "graduationYears").Count == 0) Add("row.graduationYears", "REQUIRED", "سنة التخرج مطلوبة");
        }
        else
        {
            Add("row.kind", "INVALID_KIND", "نوع الشرط غير صحيح");
        }

        var duplicate = await FindDuplicateRuleRow(id, row, ct);
        if (duplicate is not null) Add("row", "DUPLICATE_RULE", "هذا الشرط موجود بالفعل في الجدول");
        return errors;
    }

    private async Task ValidateScoreOrGrade(
        JsonObject row,
        string mode,
        List<object> errors,
        Action<string, string, string> add,
        CancellationToken ct)
    {
        if (mode == "TAGDIR")
        {
            var min = ReadString(row, "grade");
            var max = ReadString(row, "gradeMax");
            if (string.IsNullOrWhiteSpace(min)) add("row.grade", "REQUIRED", "الحد الأدنى للتقدير مطلوب");
            if (string.IsNullOrWhiteSpace(max)) add("row.gradeMax", "REQUIRED", "الحد الأقصى للتقدير مطلوب");
            if (!string.IsNullOrWhiteSpace(min) && !string.IsNullOrWhiteSpace(max))
            {
                var rank = await GradeRank(ct);
                if (!rank.ContainsKey(min)) add("row.grade", "GRADE_NOT_FOUND", "الحد الأدنى للتقدير غير موجود");
                if (!rank.ContainsKey(max)) add("row.gradeMax", "GRADE_NOT_FOUND", "الحد الأقصى للتقدير غير موجود");
                if (rank.TryGetValue(min, out var minRank) && rank.TryGetValue(max, out var maxRank) && maxRank > minRank)
                {
                    add("row.gradeMax", "GRADE_RANGE_INVERTED", "الحد الأقصى للتقدير لا يمكن أن يكون أقل من الحد الأدنى");
                }
            }
            return;
        }

        var scoreMin = ReadDecimal(row, "scoreMin");
        var scoreMax = ReadDecimal(row, "scoreMax");
        if (scoreMin is null) add("row.scoreMin", "REQUIRED", "الحد الأدنى للدرجة مطلوب");
        if (scoreMax is null) add("row.scoreMax", "REQUIRED", "الحد الأقصى للدرجة مطلوب");
        if (scoreMin is not null && (scoreMin < 0 || scoreMin > 100)) add("row.scoreMin", "PERCENTAGE_OUT_OF_RANGE", "الحد الأدنى للدرجة يجب أن يكون بين 0 و100");
        if (scoreMax is not null && scoreMax < 0) add("row.scoreMax", "PERCENTAGE_OUT_OF_RANGE", "الحد الأقصى للدرجة يجب أن يكون أكبر من أو يساوي صفر");
        if (scoreMin is not null && scoreMax is not null && scoreMax < scoreMin) add("row.scoreMax", "GRADE_RANGE_INVERTED", "الحد الأقصى للدرجة يجب ألا يقل عن الحد الأدنى");
    }

    private async Task<string?> FindDuplicateRuleRow(string id, JsonObject row, CancellationToken ct)
    {
        var candidate = RuleCompositeKey(row);
        if (candidate is null) return null;
        var rows = await List("applicationRuleRows", ct);
        foreach (var item in rows)
        {
            if (ReadString(item, "id") == id) continue;
            if (item["row"] is not JsonObject other) continue;
            if (RuleCompositeKey(other) == candidate) return ReadString(item, "id");
        }
        return null;
    }

    private static string? RuleCompositeKey(JsonObject row)
    {
        var kind = ReadString(row, "kind");
        var category = ReadString(row, "categoryCode");
        if (kind is null || category is null) return null;
        var parts = new List<string?> { kind, category, ReadString(row, "excellenceMode") };
        if (kind == "thanawi")
        {
            parts.AddRange([
                ReadString(row, "examRound"),
                ReadString(row, "committee"),
                ReadDecimal(row, "graduationYear")?.ToString(),
                JoinSorted(ReadArrayStrings(row, "schoolCategories")),
                ReadString(row, "grade"),
                ReadString(row, "gradeMax"),
                ReadDecimal(row, "scoreMin")?.ToString(),
                ReadString(row, "minScoreOperator"),
                ReadDecimal(row, "scoreMax")?.ToString(),
                ReadString(row, "maxScoreOperator"),
            ]);
        }
        else if (kind == "university")
        {
            parts.AddRange([
                ReadString(row, "facultyCode"),
                ReadString(row, "specializationCode"),
                JoinSorted(ReadArrayStrings(row, "type")),
                ReadString(row, "grade"),
                ReadString(row, "gradeMax"),
                ReadDecimal(row, "scoreMin")?.ToString(),
                ReadString(row, "minScoreOperator"),
                ReadDecimal(row, "scoreMax")?.ToString(),
                ReadString(row, "maxScoreOperator"),
                JoinSorted(ReadArrayStrings(row, "academicDegrees")),
                JoinSorted(ReadArrayStrings(row, "committees")),
                JoinSorted(ReadArrayNumbers(row, "graduationYears").Select(x => x.ToString()).ToList()),
            ]);
        }
        return string.Join("::", parts.Select(x => x ?? ""));
    }

    private async Task<Dictionary<string, int>> GradeRank(CancellationToken ct)
        => (await lookupsDb.LookupItems.AsNoTracking()
            .Where(x => x.LookupKey == "academic-grades")
            .OrderBy(x => x.SortOrder)
            .Select(x => new { x.Code, x.SortOrder })
            .ToListAsync(ct))
            .ToDictionary(x => x.Code, x => x.SortOrder, StringComparer.Ordinal);

    private async Task<List<JsonObject>> JoinedConfigs(CancellationToken ct)
    {
        var configs = await List("applicantCategoryConfigs", ct);
        var specs = await List("applicantCategorySpecializations", ct);
        var years = await List("applicantSpecializationYears", ct);
        var categories = await Lookup("applicant-categories", ct);
        return configs.OrderBy(x => ReadNumber(x, "sortOrder")).Select(c =>
        {
            var cat = categories.FirstOrDefault(x => ReadString(x, "code") == ReadString(c, "categoryId"));
            var childSpecs = specs.Where(s => ReadString(s, "configId") == ReadString(c, "id")).ToList();
            var specIds = childSpecs.Select(s => ReadString(s, "id")).ToHashSet();
            var realSpecs = childSpecs.Where(s => ReadString(s, "specializationId") != "__default__").ToList();
            var implicitSpec = childSpecs.FirstOrDefault(s => ReadString(s, "specializationId") == "__default__");
            Merge(c, new JsonObject
            {
                ["categoryCode"] = ReadString(c, "categoryId"),
                ["categoryNameAr"] = ReadString(cat, "name") ?? ReadString(c, "categoryId"),
                ["categoryType"] = ReadString(cat, "type") ?? "university",
                ["categoryFacultyCodes"] = cat?["facultyCodes"]?.DeepClone() ?? new JsonArray(),
                ["categorySpecializationCodes"] = cat?["specializationCodes"]?.DeepClone() ?? new JsonArray(),
                ["lockedGender"] = LockedGender(cat),
                ["singleAxis"] = implicitSpec is not null && realSpecs.Count == 0,
                ["implicitSpecId"] = implicitSpec is null || realSpecs.Count > 0 ? null : ReadString(implicitSpec, "id"),
                ["specializationCount"] = realSpecs.Count,
                ["yearCount"] = years.Count(y => specIds.Contains(ReadString(y, "categorySpecializationId"))),
                ["excellenceCriterion"] = ReadString(cat, "excellenceCriterion"),
            });
            return c;
        }).ToList();
    }

    private static JsonObject JoinSpec(JsonObject s, List<JsonObject> years, List<JsonObject> lookupSpecs)
    {
        var spec = lookupSpecs.FirstOrDefault(x => ReadString(x, "code") == ReadString(s, "specializationId"));
        Merge(s, new JsonObject
        {
            ["specializationNameAr"] = ReadString(spec, "name") ?? ReadString(s, "specializationId"),
            ["yearCount"] = years.Count(y => ReadString(y, "categorySpecializationId") == ReadString(s, "id")),
        });
        return s;
    }

    private async Task<List<JsonObject>> Lookup(string key, CancellationToken ct)
        => (await lookupsDb.LookupItems.AsNoTracking()
            .Where(x => x.LookupKey == key)
            .OrderBy(x => x.SortOrder)
            .Select(x => x.PayloadJson)
            .ToListAsync(ct))
            .Select(Parse)
            .ToList();

    private async Task<List<JsonObject>> List(string bucket, CancellationToken ct)
        => (await db.Items.AsNoTracking().Where(x => x.Bucket == bucket).OrderBy(x => x.SortOrder).Select(x => x.PayloadJson).ToListAsync(ct)).Select(Parse).ToList();

    private async Task<JsonObject?> Get(string bucket, string id, CancellationToken ct)
        => await db.Items.AsNoTracking().Where(x => x.Bucket == bucket && x.Id == id).Select(x => x.PayloadJson).FirstOrDefaultAsync(ct) is { } payload ? Parse(payload) : null;

    private async Task Upsert(string bucket, string id, JsonObject payload, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == bucket && x.Id == id, ct);
        if (item is null)
        {
            var max = await db.Items.Where(x => x.Bucket == bucket).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.Items.Add(AdminJsonItem.Create(bucket, id, payload.ToJsonString(JsonOptions), max + 1));
        }
        else item.ReplacePayload(payload.ToJsonString(JsonOptions));
        await db.SaveChangesAsync(ct);
    }

    private async Task Delete(string bucket, string id, CancellationToken ct)
    {
        var item = await db.Items.FirstOrDefaultAsync(x => x.Bucket == bucket && x.Id == id, ct);
        if (item is not null)
        {
            db.Items.Remove(item);
            await db.SaveChangesAsync(ct);
        }
    }

    private static void Merge(JsonObject target, JsonObject patch)
    {
        foreach (var (key, value) in patch) target[key] = value?.DeepClone();
    }

    private static string? LockedGender(JsonObject? cat)
    {
        var scope = cat?["genderScope"]?.AsArray().Select(x => x?.GetValue<string>()).Where(x => x is not null).Cast<string>().ToList() ?? [];
        return scope.Count == 1 ? scope[0] : null;
    }

    private static int MaxGraduationYear(JsonObject row)
        => row["graduationYears"]?.AsArray().Select(x => x?.GetValue<int>() ?? 0).DefaultIfEmpty(0).Max() ?? 0;

    private static JsonObject Parse(string payload) => JsonNode.Parse(payload)?.AsObject() ?? new JsonObject();
    private static string? ReadString(JsonObject? obj, string property) => obj is not null && obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<string>() : null;
    private static bool? ReadBool(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) ? value?.GetValue<bool>() : null;
    private static int ReadNumber(JsonObject obj, string property) => obj.TryGetPropertyValue(property, out var value) && value is not null ? value.GetValue<int>() : 0;
    private static decimal? ReadDecimal(JsonObject obj, string property)
    {
        if (!obj.TryGetPropertyValue(property, out var value) || value is null) return null;
        try { return value.GetValue<decimal>(); }
        catch { return null; }
    }

    private static DateOnly? ReadDate(JsonObject obj, string property)
    {
        var value = ReadString(obj, property);
        return DateOnly.TryParse(value, out var date) ? date : null;
    }

    private static List<string> ReadArrayStrings(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) && value is JsonArray arr
            ? arr.Select(x => x?.GetValue<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToList()
            : [];

    private static List<decimal> ReadArrayNumbers(JsonObject obj, string property)
        => obj.TryGetPropertyValue(property, out var value) && value is JsonArray arr
            ? arr.Select(x =>
                {
                    try { return x?.GetValue<decimal>(); }
                    catch { return null; }
                })
                .Where(x => x is not null)
                .Cast<decimal>()
                .ToList()
            : [];

    private static string JoinSorted(List<string> values)
        => string.Join("|", values.Order(StringComparer.Ordinal));

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
