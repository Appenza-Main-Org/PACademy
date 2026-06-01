using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed class LookupsSeeder(IWebHostEnvironment environment, ILogger<LookupsSeeder> logger)
{
    public async Task SeedAsync(ILookupsDbContext db, CancellationToken ct = default)
    {
        if (!await db.LookupRows.AnyAsync(ct))
        {
            var path = Path.Combine(environment.ContentRootPath, "SeedData", "lookups.seed.json");
            await using var stream = File.OpenRead(path);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var lookups = doc.RootElement.GetProperty("lookups");
            var now = DateTimeOffset.UtcNow;
            var count = 0;

            foreach (var lookup in lookups.EnumerateObject())
            {
                foreach (var row in lookup.Value.EnumerateArray())
                {
                    var obj = JsonNode.Parse(row.GetRawText())!.AsObject();
                    var code = LookupJson.StringProp(obj, "code") ?? throw new InvalidOperationException($"{lookup.Name} row missing code");
                    var name = LookupJson.StringProp(obj, "name") ?? throw new InvalidOperationException($"{lookup.Name}:{code} row missing name");
                    var isActive = LookupJson.BoolProp(obj, "isActive") ?? true;

                    db.LookupRows.Add(new LookupRowEntity
                    {
                        LookupKey = lookup.Name,
                        Code = code,
                        Name = name,
                        IsActive = isActive,
                        PayloadJson = obj.ToJsonString(LookupJson.Options),
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    count++;
                }
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} lookup rows from frontend mock seed", count);
        }

        await GovernorateLookupNormalizer.SynchronizeAsync(db, ct);
        logger.LogInformation("Synchronized {Count} governorate lookup rows to Egyptian NID codes", EgyptianGovernorateLookupData.All.Count);
    }
}
