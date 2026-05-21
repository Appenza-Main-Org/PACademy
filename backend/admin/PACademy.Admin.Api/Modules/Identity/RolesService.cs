using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class RolesService(IIdentityDbContext db)
{
    public async Task<IReadOnlyList<JsonObject>> ListAsync(bool includeDeleted, CancellationToken ct) =>
        (await db.Roles.AsNoTracking().OrderBy(x => x.Key).ToListAsync(ct)).Select(ToJson).ToList();

    public async Task<JsonObject?> GetByIdAsync(string id, CancellationToken ct)
    {
        var row = await db.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> CreateAsync(JsonObject payload, CancellationToken ct)
    {
        var key = IdentityJson.StringProp(payload, "key") ?? throw new FluentValidation.ValidationException("key مطلوب");
        if (await db.Roles.AnyAsync(x => x.Key == key, ct))
            throw new ConflictException("ROLE_KEY_DUPLICATE", "مفتاح الدور موجود بالفعل");
        var now = DateTimeOffset.UtcNow;
        var obj = IdentityJson.Clone(payload);
        obj["id"] = $"ROLE-CUSTOM-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        obj["isSystem"] = false;
        obj["createdAt"] = now;
        obj["updatedAt"] = now;
        var entity = new RoleEntity
        {
            Id = IdentityJson.StringProp(obj, "id")!,
            Key = key,
            LabelAr = IdentityJson.StringProp(obj, "labelAr") ?? key,
            IsSystem = false,
            PayloadJson = obj.ToJsonString(IdentityJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Roles.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<JsonObject> UpdateAsync(string id, JsonObject patch, CancellationToken ct)
    {
        var entity = await db.Roles.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("الدور غير موجود");
        var obj = ToJson(entity);
        foreach (var item in patch) obj[item.Key] = item.Value?.DeepClone();
        entity.LabelAr = IdentityJson.StringProp(obj, "labelAr") ?? entity.LabelAr;
        entity.PayloadJson = obj.ToJsonString(IdentityJson.Options);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    public async Task<object> DependenciesAsync(string id, CancellationToken ct)
    {
        var role = await db.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new EntityNotFoundException("الدور غير موجود");
        var users = await db.Users.CountAsync(x => x.Role == role.Key, ct);
        return new { counts = new { users }, blocking = users > 0 };
    }

    private static JsonObject ToJson(RoleEntity entity)
    {
        var obj = IdentityJson.Parse(entity.PayloadJson);
        obj["id"] = entity.Id;
        obj["key"] = entity.Key;
        obj["labelAr"] = entity.LabelAr;
        obj["isSystem"] = entity.IsSystem;
        obj["createdAt"] = entity.CreatedAt;
        obj["updatedAt"] = entity.UpdatedAt;
        obj["rowVersion"] = Convert.ToBase64String(entity.RowVersion);
        return obj;
    }
}
