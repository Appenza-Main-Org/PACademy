using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Identity;

public sealed class IdentitySeeder(IWebHostEnvironment environment, ILogger<IdentitySeeder> logger)
{
    private const string BootstrapAdminNationalId = "28705260103619";

    public async Task SeedAsync(IIdentityDbContext db, CancellationToken ct = default)
    {
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "identity.seed.json");
        await using var stream = File.OpenRead(path);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var now = DateTimeOffset.UtcNow;

        await RemoveNonBootstrapIdentityAsync(db, ct);

        foreach (var officer in root.GetProperty("officers").EnumerateArray())
        {
            var obj = JsonNode.Parse(officer.GetRawText())!.AsObject();
            var nationalId = IdentityJson.StringProp(obj, "nationalId")!;
            if (nationalId != BootstrapAdminNationalId) continue;
            var existingOfficer = await db.Officers.FirstOrDefaultAsync(x => x.NationalId == nationalId, ct);
            if (existingOfficer is null)
            {
                db.Officers.Add(new OfficerEntity
                {
                    NationalId = nationalId,
                    FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!,
                    OfficerCode = IdentityJson.StringProp(obj, "officerCode")!,
                    MobileNumber = IdentityJson.StringProp(obj, "mobileNumber")!,
                    UserType = IdentityJson.StringProp(obj, "userType")!
                });
                continue;
            }
            existingOfficer.FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!;
            existingOfficer.OfficerCode = IdentityJson.StringProp(obj, "officerCode")!;
            existingOfficer.MobileNumber = IdentityJson.StringProp(obj, "mobileNumber")!;
            existingOfficer.UserType = IdentityJson.StringProp(obj, "userType")!;
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
            if (nationalId != BootstrapAdminNationalId) continue;
            var existingUser = await db.Users.FirstOrDefaultAsync(x => x.NationalId == nationalId, ct);
            if (existingUser is null)
            {
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
                continue;
            }
            existingUser.FullArabicName = IdentityJson.StringProp(obj, "fullArabicName")!;
            existingUser.Role = IdentityJson.StringProp(obj, "role")!;
            existingUser.AccountStatus = IdentityJson.StringProp(obj, "accountStatus")!;
            existingUser.PayloadJson = obj.ToJsonString(IdentityJson.Options);
            existingUser.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded missing identity data");
    }

    private async Task RemoveNonBootstrapIdentityAsync(IIdentityDbContext db, CancellationToken ct)
    {
        var users = await RemoveRowsAsync(db.Users, ct);
        var officers = await RemoveRowsAsync(db.Officers, ct);
        if (users == 0 && officers == 0) return;

        logger.LogInformation(
            "Removed {UserCount} non-bootstrap users and {OfficerCount} non-bootstrap officers; bootstrap admin {NationalId} remains",
            users,
            officers,
            BootstrapAdminNationalId);
    }

    private static async Task<int> RemoveRowsAsync<TEntity>(DbSet<TEntity> rows, CancellationToken ct)
        where TEntity : class
    {
        try
        {
            return await rows
                .Where(x => EF.Property<string>(x, "NationalId") != BootstrapAdminNationalId)
                .ExecuteDeleteAsync(ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("ExecuteDelete", StringComparison.Ordinal))
        {
            var staleRows = await rows
                .Where(x => EF.Property<string>(x, "NationalId") != BootstrapAdminNationalId)
                .ToListAsync(ct);
            rows.RemoveRange(staleRows);
            return staleRows.Count;
        }
    }
}
