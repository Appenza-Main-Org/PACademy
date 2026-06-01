using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed class LookupsSeeder(IWebHostEnvironment environment, ILogger<LookupsSeeder> logger)
{
    private static readonly OfficialGovernorate[] OfficialGovernorates =
    [
        new("01", "محافظة القاهرة", "القاهرة الكبرى"),
        new("02", "محافظة الإسكندرية", "الوجه البحري"),
        new("03", "محافظة بورسعيد", "القناة"),
        new("04", "محافظة السويس", "القناة"),
        new("11", "محافظة دمياط", "الوجه البحري"),
        new("12", "محافظة الدقهلية", "الوجه البحري"),
        new("13", "محافظة الشرقية", "الوجه البحري"),
        new("14", "محافظة القليوبية", "القاهرة الكبرى"),
        new("15", "محافظة كفر الشيخ", "الوجه البحري"),
        new("16", "محافظة الغربية", "الوجه البحري"),
        new("17", "محافظة المنوفية", "الوجه البحري"),
        new("18", "محافظة البحيرة", "الوجه البحري"),
        new("19", "محافظة الإسماعيلية", "القناة"),
        new("21", "محافظة الجيزة", "القاهرة الكبرى"),
        new("22", "محافظة بني سويف", "الوجه القبلي"),
        new("23", "محافظة الفيوم", "الوجه القبلي"),
        new("24", "محافظة المنيا", "الوجه القبلي"),
        new("25", "محافظة أسيوط", "الوجه القبلي"),
        new("26", "محافظة سوهاج", "الوجه القبلي"),
        new("27", "محافظة قنا", "الوجه القبلي"),
        new("28", "محافظة أسوان", "الوجه القبلي"),
        new("29", "محافظة الأقصر", "الوجه القبلي"),
        new("31", "محافظة البحر الأحمر", "الحدود"),
        new("32", "محافظة الوادي الجديد", "الحدود"),
        new("33", "محافظة مطروح", "الحدود"),
        new("34", "محافظة شمال سيناء", "الحدود"),
        new("35", "محافظة جنوب سيناء", "الحدود"),
        new("88", "خارج الجمهورية", "الحدود"),
    ];

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

        await SyncGovernorateNationalIdCodesAsync(db, ct);
    }

    private async Task SyncGovernorateNationalIdCodesAsync(ILookupsDbContext db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var existingGovernorates = await db.LookupRows
            .Where(x => x.LookupKey == "governorates")
            .ToListAsync(ct);
        var policeStations = await db.LookupRows
            .Where(x => x.LookupKey == "police-stations")
            .ToListAsync(ct);
        var byCode = existingGovernorates.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

        foreach (var governorate in OfficialGovernorates)
        {
            if (!byCode.TryGetValue(governorate.Code, out var row))
            {
                row = new LookupRowEntity
                {
                    LookupKey = "governorates",
                    Code = governorate.Code,
                    Name = governorate.Name,
                    IsActive = true,
                    PayloadJson = GovernoratePayload(governorate).ToJsonString(LookupJson.Options),
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.LookupRows.Add(row);
                existingGovernorates.Add(row);
                byCode[governorate.Code] = row;
            }

            row.Name = governorate.Name;
            row.IsActive = true;
            row.PayloadJson = GovernoratePayload(governorate).ToJsonString(LookupJson.Options);
            row.UpdatedAt = now;
        }

        var officialByName = OfficialGovernorates.ToDictionary(x => NormalizeGovernorateName(x.Name));
        foreach (var stale in existingGovernorates.ToList())
        {
            if (OfficialGovernorates.Any(x => x.Code == stale.Code)) continue;
            if (!officialByName.TryGetValue(NormalizeGovernorateName(stale.Name), out var official)) continue;

            RewritePoliceStationGovernorateRefs(policeStations, stale.Code, official.Code, now);
            db.LookupRows.Remove(stale);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Synchronized {Count} governorate lookup rows to Egyptian NID codes", OfficialGovernorates.Length);
    }

    private static JsonObject GovernoratePayload(OfficialGovernorate governorate) => new()
    {
        ["code"] = governorate.Code,
        ["name"] = governorate.Name,
        ["isActive"] = true,
        ["region"] = governorate.Region,
        ["nationalIdCode"] = governorate.Code
    };

    private static void RewritePoliceStationGovernorateRefs(
        IEnumerable<LookupRowEntity> policeStations,
        string fromCode,
        string toCode,
        DateTimeOffset now)
    {
        foreach (var station in policeStations)
        {
            var payload = LookupJson.ParseObject(station.PayloadJson);
            if (LookupJson.StringProp(payload, "governorateCode") != fromCode) continue;

            payload["governorateCode"] = toCode;
            station.PayloadJson = payload.ToJsonString(LookupJson.Options);
            station.UpdatedAt = now;
        }
    }

    private static string NormalizeGovernorateName(string value)
    {
        var normalized = value
            .Replace("محافظة", "", StringComparison.Ordinal)
            .Replace("مرسى مطروح", "مطروح", StringComparison.Ordinal)
            .Replace("أ", "ا", StringComparison.Ordinal)
            .Replace("إ", "ا", StringComparison.Ordinal)
            .Replace("آ", "ا", StringComparison.Ordinal)
            .Replace("ة", "ه", StringComparison.Ordinal)
            .Trim();
        return string.Join(' ', normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private sealed record OfficialGovernorate(string Code, string Name, string Region);
}
