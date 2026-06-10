using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

/// <summary>
/// One-time (idempotent) startup self-heal: applicants who registered while
/// the NID-derive fallback drew from the retired 6-name-per-gender pools all
/// share the same handful of full names. Regenerates those placeholder names
/// through <see cref="ArabicNameGenerator"/> — deterministically from each
/// applicant's NID — in every place the old name was persisted:
///
///   1. the `applicants` identity row (`FullName`),
///   2. the portal draft payload (`profile.fullName` / `auth.fullName`),
///   3. the applicant-management projection (`name` + the nested copies).
///
/// Only exact matches against <see cref="ArabicNameGenerator.LegacyPlaceholderNames"/>
/// are touched, and only at the JSON paths the derive flow wrote — names the
/// applicant typed elsewhere (family members, vothiqa relatives) are never
/// rewritten even if they coincide with a retired pool name. Once a name is
/// regenerated it can no longer match the legacy set (4 parts vs 3), so
/// re-running on every boot is a no-op.
/// </summary>
public static class LegacyNameNormalizer
{
    /// <summary>JSON paths the derive flow wrote the placeholder name to.</summary>
    private static readonly string[][] NamePaths =
    [
        ["name"],
        ["fullName"],
        ["profile", "fullName"],
        ["auth", "fullName"],
    ];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public static async Task RegenerateLegacyNamesAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var identityDb = scope.ServiceProvider.GetRequiredService<IApplicantsDbContext>();
        var portalDb = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

        var legacyNames = ArabicNameGenerator.LegacyPlaceholderNames.ToArray();

        // 1. Identity rows — indexed equality match, cheap at any volume.
        var placeholderRows = await identityDb.Applicants
            .Where(a => a.FullName != null && legacyNames.Contains(a.FullName))
            .ToListAsync(ct);
        foreach (var row in placeholderRows)
        {
            var regenerated = RegenerateFor(row.NationalId);
            if (regenerated is not null) row.ReplacePlaceholderName(regenerated);
        }
        if (placeholderRows.Count > 0) await identityDb.SaveChangesAsync(ct);

        // 2 + 3. JSON payload copies. Both tables are small (one draft row and
        // a handful of projection rows per portal applicant), so candidates
        // are filtered in memory rather than via a 12-way LIKE chain.
        var touched = false;
        await foreach (var record in portalDb.PortalRecords.AsAsyncEnumerable().WithCancellation(ct))
            touched |= TryRewritePayload(record.PayloadJson, legacyNames, json => record.PayloadJson = json);
        await foreach (var record in portalDb.ApplicantManagementRecords.AsAsyncEnumerable().WithCancellation(ct))
        {
            // Blank NationalId columns must fall through to the payload's own
            // nationalId fields, so empty is passed as "unknown", not as a key.
            var columnNid = string.IsNullOrWhiteSpace(record.NationalId) ? null : record.NationalId;
            touched |= TryRewritePayload(record.PayloadJson, legacyNames, json => record.PayloadJson = json, columnNid);
        }
        if (touched) await portalDb.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Replaces legacy placeholder values at the known name paths of one JSON
    /// payload. Returns true (and hands the re-serialized JSON to
    /// <paramref name="assign"/>) only when something actually changed.
    /// </summary>
    private static bool TryRewritePayload(
        string payloadJson, string[] legacyNames, Action<string> assign, string? knownNid = null)
    {
        if (!legacyNames.Any(payloadJson.Contains)) return false;

        JsonObject payload;
        try
        {
            if (JsonNode.Parse(payloadJson) is not JsonObject parsed) return false;
            payload = parsed;
        }
        catch (JsonException)
        {
            return false;
        }

        var nid = knownNid
            ?? StringAt(payload, ["auth", "nationalId"])
            ?? StringAt(payload, ["profile", "nationalId"])
            ?? StringAt(payload, ["nationalId"]);
        var regenerated = RegenerateFor(nid);
        if (regenerated is null) return false;

        var changed = false;
        foreach (var path in NamePaths)
        {
            var parent = path.Length == 1 ? payload : payload[path[0]] as JsonObject;
            var key = path[^1];
            if (parent?[key] is JsonValue value
                && value.TryGetValue<string>(out var current)
                && ArabicNameGenerator.LegacyPlaceholderNames.Contains(current))
            {
                parent[key] = regenerated;
                changed = true;
            }
        }

        if (changed) assign(payload.ToJsonString(JsonOpts));
        return changed;
    }

    private static string? StringAt(JsonObject root, string[] path)
    {
        JsonNode? node = root;
        foreach (var key in path) node = node?[key];
        return node is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
    }

    /// <summary>
    /// Deterministic replacement name for a NID — same derivation the login
    /// flow uses (gender digit 13, odd = male). Null when the NID is
    /// malformed, in which case the placeholder is left as-is.
    /// </summary>
    private static string? RegenerateFor(string? nationalId)
    {
        if (nationalId is null || nationalId.Length != 14 || !nationalId.All(char.IsDigit)) return null;
        return ArabicNameGenerator.FullNameFor(nationalId, ArabicNameGenerator.GenderFromNid(nationalId));
    }
}
