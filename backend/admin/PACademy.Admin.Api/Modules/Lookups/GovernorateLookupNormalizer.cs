using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Lookups;

internal static class GovernorateLookupNormalizer
{
    public static async Task SynchronizeAsync(ILookupsDbContext db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var changed = false;
        var existingGovernorates = await db.LookupRows
            .Where(x => x.LookupKey == "governorates")
            .ToListAsync(ct);
        var policeStations = await db.LookupRows
            .Where(x => x.LookupKey == "police-stations")
            .ToListAsync(ct);
        var byCode = existingGovernorates
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var governorate in EgyptianGovernorateLookupData.All)
        {
            var payload = EgyptianGovernorateLookupData.Payload(governorate).ToJsonString(LookupJson.Options);
            if (!byCode.TryGetValue(governorate.Code, out var row))
            {
                row = new LookupRowEntity
                {
                    LookupKey = "governorates",
                    Code = governorate.Code,
                    Name = governorate.Name,
                    IsActive = true,
                    PayloadJson = payload,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.LookupRows.Add(row);
                existingGovernorates.Add(row);
                byCode[governorate.Code] = row;
                changed = true;
                continue;
            }

            if (row.Name == governorate.Name && row.IsActive && row.PayloadJson == payload) continue;

            row.Name = governorate.Name;
            row.IsActive = true;
            row.PayloadJson = payload;
            row.UpdatedAt = now;
            changed = true;
        }

        var officialCodes = EgyptianGovernorateLookupData.All.Select(x => x.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var officialByName = EgyptianGovernorateLookupData.All.ToDictionary(x => EgyptianGovernorateLookupData.NormalizeName(x.Name));
        foreach (var stale in existingGovernorates.ToList())
        {
            if (officialCodes.Contains(stale.Code)) continue;
            if (!officialByName.TryGetValue(EgyptianGovernorateLookupData.NormalizeName(stale.Name), out var official)) continue;

            RewritePoliceStationGovernorateRefs(policeStations, stale.Code, official.Code, now);
            db.LookupRows.Remove(stale);
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }

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
}

internal static class EgyptianGovernorateLookupData
{
    public static readonly IReadOnlyList<OfficialGovernorate> All =
    [
        new("01", "محافظة القاهرة"),
        new("02", "محافظة الإسكندرية"),
        new("03", "محافظة بورسعيد"),
        new("04", "محافظة السويس"),
        new("11", "محافظة دمياط"),
        new("12", "محافظة الدقهلية"),
        new("13", "محافظة الشرقية"),
        new("14", "محافظة القليوبية"),
        new("15", "محافظة كفر الشيخ"),
        new("16", "محافظة الغربية"),
        new("17", "محافظة المنوفية"),
        new("18", "محافظة البحيرة"),
        new("19", "محافظة الإسماعيلية"),
        new("21", "محافظة الجيزة"),
        new("22", "محافظة بني سويف"),
        new("23", "محافظة الفيوم"),
        new("24", "محافظة المنيا"),
        new("25", "محافظة أسيوط"),
        new("26", "محافظة سوهاج"),
        new("27", "محافظة قنا"),
        new("28", "محافظة أسوان"),
        new("29", "محافظة الأقصر"),
        new("31", "محافظة البحر الأحمر"),
        new("32", "محافظة الوادي الجديد"),
        new("33", "محافظة مطروح"),
        new("34", "محافظة شمال سيناء"),
        new("35", "محافظة جنوب سيناء"),
        new("88", "خارج الجمهورية"),
    ];

    public static JsonObject Payload(OfficialGovernorate governorate) => new()
    {
        ["code"] = governorate.Code,
        ["name"] = governorate.Name,
        ["isActive"] = true
    };

    public static string NormalizeName(string value)
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
}

internal sealed record OfficialGovernorate(string Code, string Name);
