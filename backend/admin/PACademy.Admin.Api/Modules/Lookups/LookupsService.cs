using System.Text.Json.Nodes;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed class LookupsService(ILookupsDbContext db, IValidator<JsonObject> validator)
{
    public async Task<IReadOnlyList<JsonObject>> ListAsync(string key, bool? isActive, string? search, CancellationToken ct)
    {
        EnsureKnown(key);
        if (key == "governorates")
        {
            await GovernorateLookupNormalizer.SynchronizeAsync(db, ct);
        }

        var query = db.LookupRows.AsNoTracking().Where(x => x.LookupKey == key);
        if (isActive is not null) query = query.Where(x => x.IsActive == isActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Code.Contains(term) || x.Name.Contains(term));
        }

        var rows = await query.OrderBy(x => x.Code).ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<JsonObject> CreateAsync(string key, JsonObject input, CancellationToken ct)
    {
        EnsureKnown(key);
        await validator.ValidateAndThrowAsync(input, ct);

        var code = LookupJson.StringProp(input, "code")?.Trim();
        if (key == "governorates" && string.IsNullOrWhiteSpace(code))
        {
            throw new ValidationException("كود المحافظة في الرقم القومي يجب أن يكون رقمين");
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            code = await NextCodeAsync(key, ct);
        }

        EnsureValidCode(key, code);
        await EnsureUniqueAsync(key, code, ignoreCode: null, ct);

        var rowJson = NormalizeRow(key, LookupJson.Clone(input));
        rowJson["code"] = code;
        rowJson["isActive"] = LookupJson.BoolProp(rowJson, "isActive") ?? true;
        var now = DateTimeOffset.UtcNow;
        var entity = new LookupRowEntity
        {
            LookupKey = key,
            Code = code,
            Name = LookupJson.StringProp(rowJson, "name")!,
            IsActive = LookupJson.BoolProp(rowJson, "isActive") ?? true,
            PayloadJson = rowJson.ToJsonString(LookupJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.LookupRows.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> UpdateAsync(string key, string code, JsonObject patch, CancellationToken ct)
    {
        EnsureKnown(key);
        var entity = await db.LookupRows.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct)
            ?? throw new EntityNotFoundException("كود المرجع غير موجود");

        var current = NormalizeRow(key, LookupJson.ParseObject(entity.PayloadJson));
        foreach (var item in patch)
        {
            current[item.Key] = item.Value?.DeepClone();
        }

        var nextCode = LookupJson.StringProp(current, "code") ?? code;
        if (nextCode != code)
        {
            EnsureValidCode(key, nextCode);
            await EnsureUniqueAsync(key, nextCode, ignoreCode: code, ct);
        }
        else
        {
            EnsureValidCode(key, nextCode);
        }

        await validator.ValidateAndThrowAsync(current, ct);
        var nextName = LookupJson.StringProp(current, "name")!;
        var nextActive = LookupJson.BoolProp(current, "isActive") ?? true;
        var now = DateTimeOffset.UtcNow;
        current["code"] = nextCode;
        current["isActive"] = nextActive;

        if (nextCode != code)
        {
            if (key == "governorates")
            {
                await RewriteLookupReferencesAsync("police-stations", "governorateCode", code, nextCode, now, ct);
            }

            var replacement = new LookupRowEntity
            {
                LookupKey = key,
                Code = nextCode,
                Name = nextName,
                IsActive = nextActive,
                PayloadJson = current.ToJsonString(LookupJson.Options),
                CreatedAt = entity.CreatedAt,
                UpdatedAt = now,
                LastModifiedBy = entity.LastModifiedBy,
                SourceSystem = entity.SourceSystem
            };
            db.LookupRows.Remove(entity);
            db.LookupRows.Add(replacement);
            await db.SaveChangesAsync(ct);
            return ToJson(replacement);
        }

        entity.Name = nextName;
        entity.IsActive = nextActive;
        entity.PayloadJson = current.ToJsonString(LookupJson.Options);
        entity.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<DeleteLookupRowResult> DeleteAsync(string key, string code, bool force, CancellationToken ct)
    {
        EnsureKnown(key);
        var entity = await db.LookupRows.FirstOrDefaultAsync(x => x.LookupKey == key && x.Code == code, ct)
            ?? throw new EntityNotFoundException("كود المرجع غير موجود");

        var check = await CountReferencesAsync(key, code, ct);
        if (check.Count > 0 && !force)
        {
            return new DeleteLookupRowResult(false, check.Reason, check.Count);
        }

        db.LookupRows.Remove(entity);
        await db.SaveChangesAsync(ct);
        return new DeleteLookupRowResult(true);
    }

    private async Task<string> NextCodeAsync(string key, CancellationToken ct)
    {
        var meta = LookupCatalog.Meta[key];
        var codes = await db.LookupRows
            .AsNoTracking()
            .Where(x => x.LookupKey == key)
            .Select(x => x.Code)
            .ToListAsync(ct);

        var max = 0;
        foreach (var code in codes)
        {
            var idx = code.LastIndexOf("-", StringComparison.Ordinal);
            if (idx < 0) continue;
            if (int.TryParse(code[(idx + 1)..], out var serial) && serial > max) max = serial;
        }

        return $"{meta.CodePrefix}-{(max + 1).ToString().PadLeft(meta.Padding, '0')}";
    }

    private async Task EnsureUniqueAsync(string key, string code, string? ignoreCode, CancellationToken ct)
    {
        var exists = await db.LookupRows.AnyAsync(
            x => x.LookupKey == key && x.Code == code && (ignoreCode == null || x.Code != ignoreCode),
            ct);
        if (exists)
        {
            throw new ConflictException(ErrorCodes.DuplicateCode, "كود المرجع مستخدم من قبل", new { key, code });
        }
    }

    private async Task<ReferenceCheck> CountReferencesAsync(string key, string code, CancellationToken ct)
    {
        var reasons = new List<string>();
        var count = 0;

        async Task AddRefsAsync(string lookupKey, Func<JsonObject, bool> predicate, string label)
        {
            var rows = await db.LookupRows.AsNoTracking().Where(x => x.LookupKey == lookupKey).ToListAsync(ct);
            var refs = rows.Select(ToJson).Count(predicate);
            if (refs <= 0) return;
            count += refs;
            reasons.Add($"{refs} {label}");
        }

        if (key == "relationships")
            await AddRefsAsync("relationships", r => LookupJson.StringProp(r, "parentCode") == code, "صلة قرابة مرتبطة كفرع");
        if (key == "jobs")
            await AddRefsAsync("jobs", r => LookupJson.StringProp(r, "parentCode") == code, "وظيفة مرتبطة بهذه الفئة");
        if (key == "governorates")
            await AddRefsAsync("police-stations", r => LookupJson.StringProp(r, "governorateCode") == code, "قسم/مركز شرطة في هذه المحافظة");
        if (key == "faculties")
            await AddRefsAsync("specializations", r => LookupJson.StringProp(r, "facultyCode") == code, "تخصص مرتبط بهذه الكلية");
        if (key == "applicant-categories")
            await AddRefsAsync("announcements", r => LookupJson.StringProp(r, "categoryCode") == code, "تنبيه مرتبط بهذه الفئة");
        if (key == "submission-types")
            await AddRefsAsync("applicant-categories", r =>
            {
                if (!r.TryGetPropertyValue("metadata", out var metadata) || metadata is not JsonObject obj) return false;
                return LookupJson.StringProp(obj, "submissionTypeCode") == code;
            }, "فئة متقدمين مرتبطة بنوع التقديم هذا");
        if (key == "applicant-divisions")
            await AddRefsAsync("announcements", r => LookupJson.StringProp(r, "divisionCode") == code, "تنبيه مرتبط بهذه الشعبة");

        return new ReferenceCheck(count, count > 0
            ? $"لا يمكن حذف هذا الكود — مستخدم في {count} سجل آخر ({string.Join("، ", reasons)})."
            : string.Empty);
    }

    private async Task RewriteLookupReferencesAsync(
        string lookupKey,
        string propertyName,
        string fromCode,
        string toCode,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var rows = await db.LookupRows.Where(x => x.LookupKey == lookupKey).ToListAsync(ct);
        foreach (var row in rows)
        {
            var payload = LookupJson.ParseObject(row.PayloadJson);
            if (LookupJson.StringProp(payload, propertyName) != fromCode) continue;

            payload[propertyName] = toCode;
            row.PayloadJson = payload.ToJsonString(LookupJson.Options);
            row.UpdatedAt = now;
        }
    }

    private static JsonObject ToJson(LookupRowEntity entity)
    {
        var obj = LookupJson.ParseObject(entity.PayloadJson);
        obj = NormalizeRow(entity.LookupKey, obj);
        obj["code"] = entity.Code;
        obj["name"] = entity.Name;
        obj["isActive"] = entity.IsActive;
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }

    private static JsonObject NormalizeRow(string key, JsonObject row)
    {
        if (key == "governorates")
        {
            row.Remove("nationalIdCode");
            row.Remove("region");
        }

        if (key == "applicant-categories")
        {
            row["minAge"] = LookupJson.IntProp(row, "minAge") ?? 17;
        }

        return row;
    }

    private static void EnsureValidCode(string key, string code)
    {
        if (key != "governorates") return;
        if (!System.Text.RegularExpressions.Regex.IsMatch(code, "^\\d{2}$"))
        {
            throw new ValidationException("كود المحافظة في الرقم القومي يجب أن يكون رقمين");
        }
    }

    private static void EnsureKnown(string key)
    {
        if (!LookupCatalog.IsKnown(key)) throw new EntityNotFoundException("نوع المرجع غير معروف");
    }

    private sealed record ReferenceCheck(int Count, string Reason);
}
