using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class IdentitySeeder(IWebHostEnvironment environment, ILogger<IdentitySeeder> logger)
{
    private const string BootstrapAdminNationalId = "28705260103619";

    private static readonly string[] RetiredDemoAdminNationalIds =
    [
        "29512011500011",
        "28804120100022",
        "29103251200066",
        "29407170300077",
        "29209221400044",
        "28702280500099",
        "29006150700033",
        "29610141900088",
        "29501081100055",
        "29009091100110"
    ];

    public async Task SeedAsync(IIdentityDbContext db, CancellationToken ct = default)
    {
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "identity.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;

        await RemoveRetiredDemoAdminsAsync(db, ct);

        foreach (var officer in root.GetProperty("officers").EnumerateArray())
        {
            var obj = JsonNode.Parse(officer.GetRawText())!.AsObject();
            var nationalId = IdentityJson.StringProp(obj, "nationalId")!;
            if (await db.Officers.AnyAsync(x => x.NationalId == nationalId, ct)) continue;
            db.Officers.Add(new OfficerEntity
            {
                NationalId = nationalId,
                FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!,
                OfficerCode = IdentityJson.StringProp(obj, "officerCode")!,
                MobileNumber = IdentityJson.StringProp(obj, "mobileNumber")!,
                UserType = IdentityJson.StringProp(obj, "userType")!
            });
        }

        foreach (var role in root.GetProperty("roles").EnumerateArray())
        {
            var obj = JsonNode.Parse(role.GetRawText())!.AsObject();
            var key = IdentityJson.StringProp(obj, "key")!;
            var existingRole = await db.Roles.FirstOrDefaultAsync(x => x.Key == key, ct);
            if (existingRole is not null)
            {
                if (existingRole.IsSystem)
                {
                    existingRole.LabelAr = IdentityJson.StringProp(obj, "labelAr")!;
                    existingRole.PayloadJson = obj.ToJsonString(IdentityJson.Options);
                    existingRole.UpdatedAt = now;
                }
                continue;
            }
            db.Roles.Add(new RoleEntity
            {
                Id = IdentityJson.StringProp(obj, "id")!,
                Key = key,
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
            var nationalId = IdentityJson.StringProp(obj, "nationalId")!;
            if (await db.Users.AnyAsync(x => x.NationalId == nationalId, ct)) continue;
            db.Users.Add(new UserEntity
            {
                Id = IdentityJson.StringProp(obj, "id")!,
                NationalId = nationalId,
                FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!,
                Role = IdentityJson.StringProp(obj, "role")!,
                AccountStatus = IdentityJson.StringProp(obj, "accountStatus")!,
                PayloadJson = obj.ToJsonString(IdentityJson.Options),
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded missing identity data");
    }

    private async Task RemoveRetiredDemoAdminsAsync(IIdentityDbContext db, CancellationToken ct)
    {
        var rows = await db.Users
            .Where(x => x.NationalId != BootstrapAdminNationalId && RetiredDemoAdminNationalIds.Contains(x.NationalId))
            .ToListAsync(ct);
        if (rows.Count == 0) return;

        db.Users.RemoveRange(rows);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Removed {Count} retired demo admin users; bootstrap admin {NationalId} remains", rows.Count, BootstrapAdminNationalId);
    }
}
