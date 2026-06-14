using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.AcquaintanceDocs;

/// <summary>
/// Admin-side read access to an applicant's acquaintance document (وثيقة
/// التعارف). The document is written by the applicant API into the normalized
/// <c>applicant_acquaintance_docs</c> / <c>_sections</c> / <c>_revisions</c>
/// tables (admin migrations own them, both services share the DB). The admin
/// applicant-detail page and the data-exchange export both read through here so
/// the portal, admin, and export planes show the same source of truth.
///
/// The document is keyed by the portal applicant id, which equals the admin
/// applicant record's <c>id</c> / <c>applicantTableId</c> / <c>adminRecordId</c>
/// — the same linkage the export uses to resolve a national id. We resolve the
/// applicant first, then match the document against every candidate id so a
/// portal-sourced applicant always finds its own document.
/// </summary>
public sealed class AcquaintanceDocReadService(AdminDbContext db, OperationalRecordsService records)
{
    /// <summary>
    /// Returns the applicant's acquaintance document as a JSON payload, or
    /// <c>null</c> when the applicant record itself does not exist (so the
    /// controller can answer 404). When the applicant exists but has not opened
    /// a document, a <c>hasDocument: false</c> envelope is returned rather than
    /// null — nullable 200 bodies surface as 204 and trip the frontend query
    /// layer.
    /// </summary>
    public async Task<JsonObject?> GetForApplicantAsync(string applicantRecordId, CancellationToken ct)
    {
        var applicant = await records.GetAsync("applicants", applicantRecordId, ct);
        if (applicant is null) return null;

        var candidateIds = CandidateApplicantIds(applicant, applicantRecordId);
        var cycleId = AdminRecordJson.StringProp(applicant, "cycleId");

        var matches = await db.ApplicantAcquaintanceDocs.AsNoTracking()
            .Where(d => candidateIds.Contains(d.ApplicantId))
            .ToListAsync(ct);

        var doc = matches
            .OrderByDescending(d => cycleId is not null && d.CycleId == cycleId)
            .ThenByDescending(d => d.UpdatedAt)
            .FirstOrDefault();

        if (doc is null)
        {
            return new JsonObject
            {
                ["hasDocument"] = false,
                ["status"] = "not_open",
                ["sections"] = new JsonObject(),
            };
        }

        var sections = await db.ApplicantAcquaintanceDocSections.AsNoTracking()
            .Where(s => s.AcquaintanceDocId == doc.Id)
            .ToListAsync(ct);

        var revisions = await db.ApplicantAcquaintanceDocRevisions.AsNoTracking()
            .Where(r => r.AcquaintanceDocId == doc.Id)
            .OrderByDescending(r => r.Version)
            .ToListAsync(ct);
        var latestRevision = revisions.FirstOrDefault();

        var sectionsObj = new JsonObject();
        foreach (var section in sections.OrderBy(s => s.SectionKey, StringComparer.Ordinal))
        {
            sectionsObj[section.SectionKey] = ParseSection(section.DataJson);
        }

        return new JsonObject
        {
            ["hasDocument"] = true,
            ["status"] = doc.Status,
            ["cycleId"] = doc.CycleId,
            ["version"] = doc.Version,
            ["openedAt"] = DtoString(doc.OpenedAt),
            ["closedAt"] = DtoString(doc.ClosedAt),
            ["lastAutosavedAt"] = DtoString(doc.LastAutosavedAt),
            ["revisionCount"] = revisions.Count,
            ["lastRevisionKind"] = latestRevision?.ChangeKind,
            ["lastRevisionAt"] = DtoString(latestRevision?.CreatedAt),
            ["sections"] = sectionsObj,
        };
    }

    /// <summary>Every id the document's <c>ApplicantId</c> could carry for this
    /// applicant — the route id plus the record's own id fields.</summary>
    private static List<string> CandidateApplicantIds(JsonObject applicant, string applicantRecordId)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal) { applicantRecordId };
        foreach (var key in new[] { "id", "applicantTableId", "adminRecordId" })
        {
            if (AdminRecordJson.StringProp(applicant, key) is { Length: > 0 } value) ids.Add(value);
        }
        return ids.ToList();
    }

    private static JsonNode? ParseSection(string dataJson)
    {
        if (string.IsNullOrWhiteSpace(dataJson)) return new JsonObject();
        try { return JsonNode.Parse(dataJson); }
        catch (System.Text.Json.JsonException) { return new JsonObject(); }
    }

    private static string? DtoString(DateTimeOffset? dto) => dto?.ToString("O", CultureInfo.InvariantCulture);
}
