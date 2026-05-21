using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class IdentitySeeder(IWebHostEnvironment environment, ILogger<IdentitySeeder> logger)
{
    public async Task SeedAsync(IIdentityDbContext db, CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(ct)) return;
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "identity.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;

        foreach (var officer in root.GetProperty("officers").EnumerateArray())
        {
            var obj = JsonNode.Parse(officer.GetRawText())!.AsObject();
            db.Officers.Add(new OfficerEntity
            {
                NationalId = IdentityJson.StringProp(obj, "nationalId")!,
                FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!,
                OfficerCode = IdentityJson.StringProp(obj, "officerCode")!,
                MobileNumber = IdentityJson.StringProp(obj, "mobileNumber")!,
                UserType = IdentityJson.StringProp(obj, "userType")!
            });
        }

        foreach (var role in root.GetProperty("roles").EnumerateArray())
        {
            var obj = JsonNode.Parse(role.GetRawText())!.AsObject();
            db.Roles.Add(new RoleEntity
            {
                Id = IdentityJson.StringProp(obj, "id")!,
                Key = IdentityJson.StringProp(obj, "key")!,
                LabelAr = IdentityJson.StringProp(obj, "labelAr")!,
                IsSystem = IdentityJson.BoolProp(obj, "isSystem") ?? true,
                PayloadJson = obj.ToJsonString(IdentityJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        foreach (var user in root.GetProperty("users").EnumerateArray())
        {
            var obj = JsonNode.Parse(user.GetRawText())!.AsObject();
            db.Users.Add(new UserEntity
            {
                Id = IdentityJson.StringProp(obj, "id")!,
                NationalId = IdentityJson.StringProp(obj, "nationalId")!,
                FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!,
                Role = IdentityJson.StringProp(obj, "role")!,
                AccountStatus = IdentityJson.StringProp(obj, "accountStatus")!,
                PayloadJson = obj.ToJsonString(IdentityJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded identity data");
    }
}
