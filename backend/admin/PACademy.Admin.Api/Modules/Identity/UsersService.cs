using System.Text.Json.Nodes;
using FluentValidation;
using FluentValidation.Results;
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
        var fullArabicName = RequiredFullArabicName(payload);
        if (!IsNationalId(nationalId))
            throw new FluentValidation.ValidationException("الرقم القومي يجب أن يكون 14 رقماً");
        if (await db.Users.AnyAsync(x => x.NationalId == nationalId, ct))
            throw new ConflictException("USER_NID_DUPLICATE", "يوجد مستخدم مسجل بهذا الرقم القومي");

        var now = DateTimeOffset.UtcNow;
        var sequence = await db.Users.CountAsync(ct) + 1;
        var id = $"U-{sequence.ToString().PadLeft(3, '0')}";
        var obj = IdentityJson.Clone(payload);
        obj["id"] = id;
        obj["fullArabicName"] = fullArabicName;
        obj["name"] = fullArabicName;
        obj["role"] = obj["roles"] is JsonArray roles && roles.Count > 0 ? roles[0]?.GetValue<string>() : IdentityJson.StringProp(obj, "role") ?? "committee_user";
        obj["active"] = IdentityJson.StringProp(obj, "accountStatus") != "inactive";
        obj["status"] = IdentityJson.StringProp(obj, "accountStatus") == "inactive" ? "suspended" : "active";
        obj["createdAt"] = now;
        obj["updatedAt"] = now;

        /* Generate the MOI sign-in credentials (username + one-time password).
         * The plaintext password is returned once below and never persisted. */
        var roleKey = IdentityJson.StringProp(obj, "role") ?? "committee_user";
        var username = await GenerateUniqueUsernameAsync(roleKey, sequence, ct);
        var temporaryPassword = IdentityCredentials.GeneratePassword();
        obj["username"] = username;
        obj["passwordHash"] = IdentityCredentials.HashPassword(temporaryPassword);
        obj["passwordUpdatedAt"] = now;
        obj["mustChangePassword"] = true;
        obj.Remove("passwordSalt");

        var entity = new UserEntity
        {
            Id = id,
            NationalId = nationalId,
            FullArabicName = fullArabicName,
            Role = IdentityJson.StringProp(obj, "role") ?? "committee_user",
            AccountStatus = IdentityJson.StringProp(obj, "accountStatus") ?? "active",
            PayloadJson = obj.ToJsonString(IdentityJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };
        await EnsureOfficerDirectoryRowAsync(payload, nationalId, ct);
        db.Users.Add(entity);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("create", entity.Id, $"إنشاء مستخدم · {entity.FullArabicName}", ct);
        var created = ToJson(entity);
        created["username"] = username;
        created["generatedUsername"] = username;
        created["temporaryPassword"] = temporaryPassword;
        return created;
    }

    /// <summary>Self-service password change: verify the current password, set a new one.</summary>
    public async Task<object> ChangePasswordAsync(string id, string currentPassword, string newPassword, CancellationToken ct)
    {
        ValidateNewPassword(newPassword);
        var entity = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("المستخدم غير موجود");
        var obj = IdentityJson.Parse(entity.PayloadJson);
        var storedHash = IdentityJson.StringProp(obj, "passwordHash");
        if (!IdentityCredentials.VerifyPassword(currentPassword, storedHash))
            throw new ConflictException("PASSWORD_MISMATCH", "كلمة المرور الحالية غير صحيحة");

        ApplyNewPassword(entity, obj, newPassword, mustChange: false);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("password_change", id, $"تغيير كلمة المرور · {entity.FullArabicName}", ct);
        return new { ok = true, changedAt = DateTimeOffset.UtcNow };
    }

    /// <summary>Super-admin reset: set the supplied password, or generate a new one when omitted.</summary>
    public async Task<object> ResetPasswordAsync(string id, string? newPassword, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("المستخدم غير موجود");
        var obj = IdentityJson.Parse(entity.PayloadJson);

        var generated = string.IsNullOrWhiteSpace(newPassword);
        var password = generated ? IdentityCredentials.GeneratePassword() : newPassword!.Trim();
        ValidateNewPassword(password);

        /* Ensure the account has a username even if it predates credential support. */
        var username = IdentityJson.StringProp(obj, "username");
        if (string.IsNullOrWhiteSpace(username))
        {
            username = await GenerateUniqueUsernameAsync(entity.Role, 0, ct);
            obj["username"] = username;
        }

        ApplyNewPassword(entity, obj, password, mustChange: true);
        await db.SaveChangesAsync(ct);
        await EmitAuditAsync("password_reset", id, $"إعادة تعيين كلمة المرور · {entity.FullArabicName}", ct);
        return new { ok = true, username, temporaryPassword = password, generated };
    }

    private static void ApplyNewPassword(UserEntity entity, JsonObject obj, string password, bool mustChange)
    {
        var now = DateTimeOffset.UtcNow;
        obj["passwordHash"] = IdentityCredentials.HashPassword(password);
        obj["passwordUpdatedAt"] = now;
        obj["mustChangePassword"] = mustChange;
        obj.Remove("passwordSalt");
        obj["updatedAt"] = now;
        entity.PayloadJson = obj.ToJsonString(IdentityJson.Options);
        entity.UpdatedAt = now;
    }

    private static void ValidateNewPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Trim().Length < 8)
            throw new ConflictException("PASSWORD_WEAK", "كلمة المرور يجب ألا تقل عن 8 أحرف");
    }

    private async Task<string> GenerateUniqueUsernameAsync(string roleKey, int sequence, CancellationToken ct)
    {
        var existing = (await db.Users.AsNoTracking().ToListAsync(ct))
            .Select(u => IdentityJson.StringProp(IdentityJson.Parse(u.PayloadJson), "username"))
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!.ToLowerInvariant())
            .ToHashSet();

        var seed = IdentityCredentials.BuildUsernameSeed(roleKey, sequence);
        var candidate = seed;
        while (existing.Contains(candidate.ToLowerInvariant()))
        {
            candidate = IdentityCredentials.Randomize(seed);
        }
        return candidate;
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
        entity.FullArabicName = RequiredFullArabicName(obj);
        obj["fullArabicName"] = entity.FullArabicName;
        obj["name"] = entity.FullArabicName;
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
        PreserveCredentials(entity, obj);
        entity.PayloadJson = obj.ToJsonString(IdentityJson.Options);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
    }

    /* `obj` is often sourced from the sanitized `ToJson` (no hash). Re-inject the
     * credential fields from the row's current payload so a profile/status/role
     * update never wipes the stored password. */
    private static void PreserveCredentials(UserEntity entity, JsonObject obj)
    {
        var existing = IdentityJson.Parse(entity.PayloadJson);
        foreach (var key in new[] { "username", "passwordHash", "passwordUpdatedAt", "mustChangePassword" })
        {
            if (obj[key] is null && existing[key] is not null)
            {
                obj[key] = existing[key]!.DeepClone();
            }
        }
    }

    private static string RequiredFullArabicName(JsonObject obj)
    {
        var fullArabicName = IdentityJson.StringProp(obj, "fullArabicName")?.Trim();
        if (!string.IsNullOrWhiteSpace(fullArabicName)) return fullArabicName;

        throw new ValidationException(
        [
            new ValidationFailure("fullArabicName", "الاسم رباعياً مطلوب")
        ]);
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
        obj["hasCredentials"] = !string.IsNullOrWhiteSpace(IdentityJson.StringProp(obj, "passwordHash"));
        return IdentityCredentials.Sanitize(obj);
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

    private async Task EnsureOfficerDirectoryRowAsync(JsonObject payload, string nationalId, CancellationToken ct)
    {
        if (await db.Officers.AnyAsync(x => x.NationalId == nationalId, ct)) return;

        db.Officers.Add(new OfficerEntity
        {
            NationalId = nationalId,
            FullArabicName = RequiredFullArabicName(payload),
            OfficerCode = IdentityJson.StringProp(payload, "officerCode") ?? nationalId,
            MobileNumber = IdentityJson.StringProp(payload, "mobileNumber") ?? "",
            UserType = NormalizeUserType(IdentityJson.StringProp(payload, "userType"))
        });
    }

    private static bool IsNationalId(string value) =>
        value.Length == 14 && value.All(char.IsDigit);

    private static string NormalizeUserType(string? value) =>
        value is "officer" or "civilian" or "contractor" ? value : "officer";
}
