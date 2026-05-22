using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class UsersService(IIdentityDbContext db, IAuditSink auditSink)
{
    public async Task<IReadOnlyList<JsonObject>> ListAsync(CancellationToken ct) =>
        (await db.Users.AsNoTracking().OrderBy(x => x.Id).ToListAsync(ct)).Select(ToJson).ToList();

    public async Task<JsonObject?> GetByIdAsync(string id, CancellationToken ct)
    {
        var row = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> CreateAsync(JsonObject payload, CancellationToken ct)
    {
        var nationalId = IdentityJson.StringProp(payload, "nationalId") ?? throw new FluentValidation.ValidationException("nationalId مطلوب");
        if (await db.Users.AnyAsync(x => x.NationalId == nationalId, ct))
            throw new ConflictException("USER_NID_DUPLICATE", "يوجد مستخدم مسجل بهذا الرقم القومي");

        var now = DateTimeOffset.UtcNow;
        var id = $"U-{(await db.Users.CountAsync(ct) + 1).ToString().PadLeft(3, '0')}";
        var obj = IdentityJson.Clone(payload);
        obj["id"] = id;
        obj["name"] = IdentityJson.StringProp(obj, "fullArabicName");
        obj["role"] = obj["roles"] is JsonArray roles && roles.Count > 0 ? roles[0]?.GetValue<string>() : IdentityJson.StringProp(obj, "role") ?? "committee_user";
        obj["active"] = IdentityJson.StringProp(obj, "accountStatus") != "inactive";
        obj["status"] = IdentityJson.StringProp(obj, "accountStatus") == "inactive" ? "suspended" : "active";
        obj["createdAt"] = now;
        obj["updatedAt"] = now;

        var entity = new UserEntity
        {
            Id = id,
            NationalId = nationalId,
            FullArabicName = IdentityJson.StringProp(obj, "fullArabicName") ?? "مستخدم",
            Role = IdentityJson.StringProp(obj, "role") ?? "committee_user",
            AccountStatus = IdentityJson.StringProp(obj, "accountStatus") ?? "active",
            PayloadJson = obj.ToJsonString(IdentityJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Users.Add(entity);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("create", entity.Id, $"إنشاء مستخدم · {entity.FullArabicName}", ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> UpdateAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("المستخدم غير موجود");
        var obj = ToJson(entity);
        foreach (var item in patch) obj[item.Key] = item.Value?.DeepClone();
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("update", entity.Id, $"تحديث مستخدم · {entity.FullArabicName}", ct);
        return ToJson(entity);
    }

    public async Task<object> Reset2FaAsync(string id, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("المستخدم غير موجود");
        var obj = ToJson(entity);
        var now = DateTimeOffset.UtcNow;
        obj["twoFactorResetAt"] = now;
        obj["twoFactorResetBy"] = "system";
        Apply(entity, obj);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("reset_2fa", id, $"إعادة ضبط التحقق الثنائي · {entity.FullArabicName}", ct);
        return new { ok = true, resetAt = now };
    }

    public async Task<object> BulkAssignAsync(JsonObject body, CancellationToken ct)
    {
        var ids = body["ids"] is JsonArray idArray
            ? idArray.Select(x => x?.GetValue<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToHashSet(StringComparer.Ordinal)
            : [];
        var role = IdentityJson.StringProp(body, "role") ?? throw new FluentValidation.ValidationException("role مطلوب");
        if (!await db.Roles.AnyAsync(x => x.Key == role, ct))
            throw new ConflictException("ROLE_NOT_FOUND", "الدور غير موجود");

        var rows = await db.Users.Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        foreach (var row in rows)
        {
            var obj = ToJson(row);
            obj["role"] = role;
            obj["roles"] = new JsonArray(role);
            Apply(row, obj);
        }

        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("bulk_assign", "bulk", $"تعيين دور {role} لعدد {rows.Count} مستخدم", ct);
        return new { updated = rows.Count };
    }

    public async Task<object> BulkImportAsync(JsonArray rows, CancellationToken ct)
    {
        var attempted = rows.Count;
        var success = 0;
        var failed = new JsonArray();

        for (var i = 0; i < rows.Count; i++)
        {
            if (rows[i] is not JsonObject row)
            {
                failed.Add(FailedRow(i, "صف غير صالح"));
                continue;
            }

            var nationalId = IdentityJson.StringProp(row, "nationalId");
            if (string.IsNullOrWhiteSpace(nationalId))
            {
                failed.Add(FailedRow(i, "الرقم القومي مطلوب"));
                continue;
            }

            var roles = row["roles"] as JsonArray ?? [];
            var role = roles.Count > 0 ? roles[0]?.GetValue<string>() : IdentityJson.StringProp(row, "role");
            if (string.IsNullOrWhiteSpace(role) || !await db.Roles.AnyAsync(x => x.Key == role, ct))
            {
                failed.Add(FailedRow(i, "الدور غير موجود"));
                continue;
            }

            var existing = await db.Users.FirstOrDefaultAsync(x => x.NationalId == nationalId, ct);
            if (existing is null)
            {
                await CreateAsync(row, ct);
            }
            else
            {
                await UpdateAsync(existing.Id, row, ct);
            }
            success++;
        }

        await EmitAuditAsync("bulk_import", "bulk", $"استيراد مستخدمين · ناجح {success} من {attempted}", ct);
        return new { attemptedCount = attempted, successCount = success, failedRows = failed };
    }

    public async Task<IReadOnlyList<object>> ActivityAsync(string id, CancellationToken ct)
    {
        var exists = await db.Users.AnyAsync(x => x.Id == id, ct);
        if (!exists) throw new EntityNotFoundException("المستخدم غير موجود");

        return await db.AuditRows
            .AsNoTracking()
            .Where(x => x.ActorUserId == id || x.EntityId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .Select(x => new
            {
                ts = x.CreatedAt.ToUnixTimeMilliseconds(),
                userId = id,
                action = x.Action,
                detail = x.Details,
                ip = ""
            })
            .Cast<object>()
            .ToListAsync(ct);
    }

    private static void Apply(UserEntity entity, JsonObject obj)
    {
        entity.FullArabicName = IdentityJson.StringProp(obj, "fullArabicName") ?? entity.FullArabicName;
        entity.Role = obj["roles"] is JsonArray roles && roles.Count > 0
            ? roles[0]?.GetValue<string>() ?? entity.Role
            : IdentityJson.StringProp(obj, "role") ?? entity.Role;
        var requestedStatus = IdentityJson.StringProp(obj, "status");
        var accountStatus = IdentityJson.StringProp(obj, "accountStatus") ?? entity.AccountStatus;
        var normalizedStatus = requestedStatus switch
        {
            "active" => "active",
            "locked" => "locked",
            "suspended" => "suspended",
            _ => accountStatus == "inactive" ? "suspended" : accountStatus == "locked" ? "locked" : "active"
        };
        entity.AccountStatus = normalizedStatus == "active" ? "active" : normalizedStatus == "locked" ? "locked" : "inactive";
        obj["role"] = entity.Role;
        obj["accountStatus"] = entity.AccountStatus;
        obj["active"] = normalizedStatus == "active";
        obj["status"] = normalizedStatus;
        obj["updatedAt"] = DateTimeOffset.UtcNow;
        entity.PayloadJson = obj.ToJsonString(IdentityJson.Options);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static JsonObject ToJson(UserEntity entity)
    {
        var obj = IdentityJson.Parse(entity.PayloadJson);
        obj["id"] = entity.Id;
        obj["nationalId"] = entity.NationalId;
        obj["fullArabicName"] = entity.FullArabicName;
        obj["role"] = entity.Role;
        obj["accountStatus"] = entity.AccountStatus;
        obj["active"] = entity.AccountStatus == "active";
        obj["status"] = entity.AccountStatus == "locked" ? "locked" : entity.AccountStatus == "inactive" ? "suspended" : "active";
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }

    private async Task EmitAuditAsync(string action, string entityId, string details, CancellationToken ct)
    {
        await auditSink.EmitAsync(new AuditEntry(
            $"AUD-IDENTITY-{Guid.NewGuid():N}",
            "identity",
            action,
            "users",
            entityId,
            "system",
            "النظام",
            details,
            DateTimeOffset.UtcNow), ct);
    }

    private static JsonObject FailedRow(int rowIndex, string error) => new()
    {
        ["rowIndex"] = rowIndex,
        ["errors"] = new JsonArray(error)
    };
}
