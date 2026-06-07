using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Modules.Payments;

public sealed class PaymentsLedgerService(OperationalRecordsService records, AdminDbContext db)
{
    public async Task<IReadOnlyList<JsonObject>> ListAsync(
        string? status,
        string? search,
        string? cycleId,
        CancellationToken ct)
    {
        var rows = await MergedRowsAsync(ct);
        return rows
            .Where(row => MatchesStatus(row, status))
            .Where(row => MatchesCycle(row, cycleId))
            .Where(row => MatchesSearch(row, search))
            .ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> ListRefundEligibleAsync(CancellationToken ct)
    {
        var rows = await MergedRowsAsync(ct);
        return rows
            .Where(row => AdminRecordJson.StringProp(row, "status") == "paid")
            .ToList();
    }

    public async Task<JsonObject?> GetAsync(string reference, CancellationToken ct)
    {
        var rows = await MergedRowsAsync(ct);
        return rows.FirstOrDefault(row => MatchesReference(row, reference));
    }

    public async Task<JsonObject?> MutateAsync(string reference, JsonObject patch, CancellationToken ct)
    {
        var row = await GetAsync(reference, ct);
        if (row is null) return null;

        var id = AdminRecordJson.StringProp(row, "id")!;
        var next = AdminRecordJson.Clone(row);
        foreach (var (key, patchValue) in patch)
        {
            next[key] = patchValue?.DeepClone();
        }
        next["lastSyncAt"] = DateTimeOffset.UtcNow.ToString("O");

        return await records.UpsertAsync("payments", id, next, ct);
    }

    private async Task<IReadOnlyList<JsonObject>> MergedRowsAsync(CancellationToken ct)
    {
        var durableRows = await records.ListAsync("payments", ct);
        var references = durableRows
            .Select(PaymentReference)
            .OfType<string>()
            .Where(reference => !string.IsNullOrWhiteSpace(reference))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var applicants = await ApplicantMapAsync(ct);
        var portalRows = await PortalPaymentRowsAsync(references, applicants, ct);
        return durableRows.Concat(portalRows).ToList();
    }

    private async Task<Dictionary<string, JsonObject>> ApplicantMapAsync(CancellationToken ct)
    {
        var applicants = await records.ListAsync("applicants", ct);
        var map = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
        foreach (var applicant in applicants)
        {
            AddApplicantKey(map, applicant, "id");
            AddApplicantKey(map, applicant, "applicantId");
            AddApplicantKey(map, applicant, "nationalId");
        }
        return map;
    }

    private async Task<IReadOnlyList<JsonObject>> PortalPaymentRowsAsync(
        HashSet<string> existingReferences,
        IReadOnlyDictionary<string, JsonObject> applicants,
        CancellationToken ct)
    {
        var paymentRecords = await db.ApplicantPortalRecords
            .AsNoTracking()
            .Where(row => row.Type == "payment")
            .OrderByDescending(row => row.UpdatedAt)
            .ToListAsync(ct);
        var rows = new List<JsonObject>();

        foreach (var record in paymentRecords)
        {
            var payload = AdminRecordJson.Parse(record.PayloadJson);
            if (!IsSuccessfulPortalPayment(payload)) continue;

            var reference = AdminRecordJson.StringProp(payload, "refNumber") ?? record.RecordId;
            if (!existingReferences.Add(reference)) continue;

            rows.Add(PortalPaymentRow(record, payload, applicants, reference));
        }

        return rows;
    }

    private static JsonObject PortalPaymentRow(
        ApplicantPortalRecordEntity record,
        JsonObject payload,
        IReadOnlyDictionary<string, JsonObject> applicants,
        string reference)
    {
        var applicantId = AdminRecordJson.StringProp(payload, "applicantId") ?? record.ApplicantId;
        applicants.TryGetValue(applicantId, out var applicant);
        var paidAt = PaymentInstant(payload, "paidAt");

        return new JsonObject
        {
            ["id"] = $"PAY-{reference}",
            ["applicantId"] = applicantId,
            ["applicantName"] = ApplicantName(applicant, applicantId),
            ["nationalId"] = ApplicantNationalId(applicant, applicantId),
            ["cycleId"] = AdminRecordJson.StringProp(applicant ?? [], "cycleId") ?? "",
            ["fawryReference"] = reference,
            ["amount"] = AdminRecordJson.NumberProp(payload, "amount") ?? 0,
            ["status"] = "paid",
            ["lastSyncAt"] = record.UpdatedAt.ToString("O"),
            ["paidAt"] = paidAt?.ToString("O") ?? record.UpdatedAt.ToString("O")
        };
    }

    private static void AddApplicantKey(
        Dictionary<string, JsonObject> map,
        JsonObject applicant,
        string key)
    {
        var value = AdminRecordJson.StringProp(applicant, key);
        if (!string.IsNullOrWhiteSpace(value)) map[value] = applicant;
    }

    private static string ApplicantName(JsonObject? applicant, string applicantId) =>
        AdminRecordJson.StringProp(applicant ?? [], "applicantName")
        ?? AdminRecordJson.StringProp(applicant ?? [], "name")
        ?? AdminRecordJson.StringProp(applicant ?? [], "fullName")
        ?? applicantId;

    private static string ApplicantNationalId(JsonObject? applicant, string applicantId) =>
        AdminRecordJson.StringProp(applicant ?? [], "nationalId") ?? applicantId;

    private static bool IsSuccessfulPortalPayment(JsonObject payload)
    {
        var status = AdminRecordJson.StringProp(payload, "status");
        return string.Equals(status, "success", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase);
    }

    private static DateTimeOffset? PaymentInstant(JsonObject payload, string key)
    {
        if (!payload.TryGetPropertyValue(key, out var node) || node is null) return null;
        if (node.GetValueKind() == System.Text.Json.JsonValueKind.Number)
        {
            var milliseconds = AdminRecordJson.NumberProp(payload, key);
            if (milliseconds is not null)
            {
                return DateTimeOffset.FromUnixTimeMilliseconds((long)milliseconds.Value);
            }
        }
        return DateTimeOffset.TryParse(node.ToString(), out var parsed) ? parsed : null;
    }

    private static bool MatchesStatus(JsonObject row, string? status) =>
        string.IsNullOrWhiteSpace(status)
        || string.Equals(status, "all", StringComparison.OrdinalIgnoreCase)
        || string.Equals(AdminRecordJson.StringProp(row, "status"), status, StringComparison.OrdinalIgnoreCase);

    private static bool MatchesCycle(JsonObject row, string? cycleId) =>
        string.IsNullOrWhiteSpace(cycleId)
        || string.Equals(cycleId, "all", StringComparison.OrdinalIgnoreCase)
        || string.Equals(AdminRecordJson.StringProp(row, "cycleId"), cycleId, StringComparison.OrdinalIgnoreCase);

    private static bool MatchesSearch(JsonObject row, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;

        return Contains(row, "applicantName", search)
            || Contains(row, "nationalId", search)
            || Contains(row, "fawryReference", search);
    }

    private static bool Contains(JsonObject row, string key, string search) =>
        AdminRecordJson.StringProp(row, key)?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;

    private static bool MatchesReference(JsonObject row, string reference) =>
        string.Equals(AdminRecordJson.StringProp(row, "fawryReference"), reference, StringComparison.OrdinalIgnoreCase)
        || string.Equals(AdminRecordJson.StringProp(row, "id"), reference, StringComparison.OrdinalIgnoreCase);

    private static string? PaymentReference(JsonObject row) =>
        AdminRecordJson.StringProp(row, "fawryReference")
        ?? AdminRecordJson.StringProp(row, "id");
}
