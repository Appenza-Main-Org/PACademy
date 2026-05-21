using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class UsersService(IIdentityDbContext db)
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
        return ToJson(entity);
    }

    public Task<IReadOnlyList<object>> ActivityAsync(string id, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<object>>(Array.Empty<object>());

    private static void Apply(UserEntity entity, JsonObject obj)
    {
        entity.FullArabicName = IdentityJson.StringProp(obj, "fullArabicName") ?? entity.FullArabicName;
        entity.Role = obj["roles"] is JsonArray roles && roles.Count > 0
            ? roles[0]?.GetValue<string>() ?? entity.Role
            : IdentityJson.StringProp(obj, "role") ?? entity.Role;
        entity.AccountStatus = IdentityJson.StringProp(obj, "accountStatus") ?? entity.AccountStatus;
        obj["role"] = entity.Role;
        obj["active"] = entity.AccountStatus != "inactive";
        obj["status"] = entity.AccountStatus == "inactive" ? "suspended" : "active";
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
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }
}
