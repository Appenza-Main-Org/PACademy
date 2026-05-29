using System.Text.Json;
using System.Text.Json.Nodes;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

/// <summary>
/// All applicant-portal business logic: draft CRUD, stage commits,
/// payment, exam-slot reservation, family approval, follow-up.
/// Keeps each concern as a private method; controller delegates here.
/// </summary>
public sealed class PortalService(PortalDbContext db)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    // ── Draft ──────────────────────────────────────────────────────────

    public async Task<JsonObject> GetOrCreateDraftAsync(string applicantId, CancellationToken ct)
    {
        var record = await db.PortalRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Type == "draft" && x.RecordId == applicantId, ct);

        if (record is null)
        {
            var blank = new JsonObject
            {
                ["applicantId"] = applicantId,
                ["cycleId"] = "CYC-2026-M",
                ["furthestStage"] = 0,
                ["suspended"] = false,
                ["lastSavedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            };
            return blank;
        }

        return ParseJson(record.PayloadJson);
    }

    public async Task<JsonObject> SaveDraftAsync(
        string applicantId,
        JsonObject partial,
        CancellationToken ct)
    {
        var record = await db.PortalRecords
            .FirstOrDefaultAsync(x => x.Type == "draft" && x.RecordId == applicantId, ct);

        var now = DateTimeOffset.UtcNow;
        if (record is null)
        {
            var draft = new JsonObject
            {
                ["applicantId"] = applicantId,
                ["cycleId"] = partial["cycleId"]?.DeepClone() ?? (JsonNode)"CYC-2026-M",
                ["furthestStage"] = partial["furthestStage"]?.DeepClone() ?? (JsonNode)0,
                ["suspended"] = false,
                ["lastSavedAt"] = now.ToUnixTimeMilliseconds(),
            };
            MergeJson(draft, partial);
            draft["lastSavedAt"] = now.ToUnixTimeMilliseconds();

            record = new ApplicantPortalRecordEntity
            {
                Type = "draft",
                RecordId = applicantId,
                ApplicantId = applicantId,
                PayloadJson = draft.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.PortalRecords.Add(record);
        }
        else
        {
            var draft = ParseJson(record.PayloadJson);
            MergeJson(draft, partial);
            draft["lastSavedAt"] = now.ToUnixTimeMilliseconds();
            record.PayloadJson = draft.ToJsonString(JsonOpts);
            record.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return ParseJson(record.PayloadJson);
    }

    // ── Stage submit ───────────────────────────────────────────────────

    public async Task<(bool Valid, Dictionary<string, string[]>? Errors)> SubmitStageAsync(
        string applicantId,
        int stage,
        JsonObject data,
        CancellationToken ct)
    {
        var partial = new JsonObject
        {
            ["furthestStage"] = stage,
        };
        MergeJson(partial, data);
        await SaveDraftAsync(applicantId, partial, ct);
        return (true, null);
    }

    // ── Verify ─────────────────────────────────────────────────────────

    public async Task<bool> VerifyApplicantAsync(string applicantId, string nationalId, string mobile, CancellationToken ct)
    {
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var storedNid = draft["auth"]?["nationalId"]?.GetValue<string>();
        var storedMobile = draft["auth"]?["phoneNumber"]?.GetValue<string>();

        if (storedNid is not null && storedMobile is not null)
        {
            return string.Equals(storedNid.Trim(), nationalId.Trim(), StringComparison.Ordinal)
                && string.Equals(storedMobile.Trim(), mobile.Trim(), StringComparison.Ordinal);
        }

        // Fallback: match against the applicant's registered national ID.
        return string.Equals(applicantId.Trim(), nationalId.Trim(), StringComparison.Ordinal);
    }

    // ── Payment ────────────────────────────────────────────────────────

    public async Task<(string IntentId, string RefNumber, string FawryCode)> CreatePaymentIntentAsync(
        string applicantId,
        string method,
        CancellationToken ct)
    {
        var refNumber = GenerateRef(applicantId);
        var fawryCode = GenerateFawryCode(applicantId, DateTimeOffset.UtcNow);
        var intentId = $"INT-{refNumber}";
        var now = DateTimeOffset.UtcNow;

        var existing = await db.PortalRecords
            .FirstOrDefaultAsync(x => x.Type == "payment" && x.RecordId == refNumber, ct);

        if (existing is null)
        {
            var payload = new JsonObject
            {
                ["refNumber"] = refNumber,
                ["applicantId"] = applicantId,
                ["intentId"] = intentId,
                ["method"] = method,
                ["status"] = "pending",
                ["fawryCode"] = fawryCode,
                ["initiatedAt"] = now.ToUnixTimeMilliseconds(),
            };
            db.PortalRecords.Add(new ApplicantPortalRecordEntity
            {
                Type = "payment",
                RecordId = refNumber,
                ApplicantId = applicantId,
                PayloadJson = payload.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            });
            await db.SaveChangesAsync(ct);
        }

        return (intentId, refNumber, fawryCode);
    }

    public async Task<(string Status, JsonObject? Receipt)> GetPaymentStatusAsync(
        string refNumber,
        CancellationToken ct)
    {
        var record = await db.PortalRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Type == "payment" && x.RecordId == refNumber, ct);

        if (record is null) return ("failed", null);

        var payload = ParseJson(record.PayloadJson);
        // Auto-succeed in demo mode: if payment is pending for more than 30 s, treat as paid.
        var initiatedAt = payload["initiatedAt"]?.GetValue<long>() ?? 0L;
        var status = payload["status"]?.GetValue<string>() ?? "pending";

        if (status == "pending" && DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - initiatedAt > 30_000)
        {
            status = "success";
        }

        return (status, payload);
    }

    public async Task<(bool Confirmed, long PaidAt)> ConfirmPaymentAsync(
        string applicantId,
        string intentId,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var paidAt = now.ToUnixTimeMilliseconds();

        var record = await db.PortalRecords
            .FirstOrDefaultAsync(x => x.Type == "payment" && x.ApplicantId == applicantId, ct);

        string? refNumber = null;
        string? fawryCode = null;
        if (record is not null)
        {
            var payload = ParseJson(record.PayloadJson);
            payload["status"] = "success";
            payload["paidAt"] = paidAt;
            record.PayloadJson = payload.ToJsonString(JsonOpts);
            record.UpdatedAt = now;
            refNumber = record.RecordId;
            fawryCode = payload["fawryCode"]?.GetValue<string>();
            await db.SaveChangesAsync(ct);
        }

        // Advance draft to stage 6 and persist payment reference so it can
        // be restored when the applicant logs in again.
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        var paymentNode = new JsonObject
        {
            ["method"] = "fawry-code",
            ["paidAt"] = paidAt,
        };
        if (refNumber is not null) paymentNode["refNumber"] = refNumber;
        if (fawryCode is not null) paymentNode["fawryCode"] = fawryCode;
        await SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 6),
            ["payment"] = paymentNode,
        }, ct);

        return (true, paidAt);
    }

    // ── Exam slots ─────────────────────────────────────────────────────

    public async Task<List<ExamSlotEntity>> ListExamSlotsAsync(CancellationToken ct)
    {
        return await db.ExamSlots
            .AsNoTracking()
            .Where(x => x.Date >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .OrderBy(x => x.Date)
            .Take(10)
            .ToListAsync(ct);
    }

    public async Task<(bool Confirmed, ExamSlotEntity? Slot)> ReserveExamSlotAsync(
        string applicantId,
        string slotId,
        CancellationToken ct)
    {
        var slot = await db.ExamSlots.FirstOrDefaultAsync(x => x.Id == slotId, ct)
            ?? throw new KeyNotFoundException($"موعد الاختبار '{slotId}' غير موجود");

        if (slot.Reserved >= slot.Capacity)
            throw new InvalidOperationException("انتهت الأماكن المتاحة في هذا الموعد");

        slot.Reserved += 1;
        slot.UpdatedAt = DateTimeOffset.UtcNow;

        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        await SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 8),
            ["examSlot"] = new JsonObject
            {
                ["slotId"] = slotId,
                ["date"] = slot.Date.ToString("yyyy-MM-dd"),
                ["time"] = slot.Time,
                ["location"] = slot.Location,
            },
        }, ct);

        await db.SaveChangesAsync(ct);
        return (true, slot);
    }

    // ── Parents approval ───────────────────────────────────────────────

    public async Task<long> ApproveParentsAsync(string applicantId, CancellationToken ct)
    {
        var approvedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        await SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 7),
            ["parentsApproved"] = true,
            ["parentsApprovedAt"] = approvedAt,
        }, ct);
        return approvedAt;
    }

    // ── Exam date pick ─────────────────────────────────────────────────

    public async Task<string> PickExamDateAsync(string applicantId, string slotId, CancellationToken ct)
    {
        // Accept full slot IDs, ISO dates, and the day-first date strings
        // currently emitted by the admin eligibility schedule.
        var candidateIds = CandidateSlotIds(slotId);
        var slot = await db.ExamSlots.AsNoTracking()
            .FirstOrDefaultAsync(x => candidateIds.Contains(x.Id), ct)
            ?? throw new KeyNotFoundException($"موعد الاختبار '{slotId}' غير موجود");

        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        await SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 8),
            ["examSlot"] = new JsonObject
            {
                ["slotId"] = slot.Id,
                ["date"] = slot.Date.ToString("yyyy-MM-dd"),
                ["time"] = slot.Time,
                ["location"] = slot.Location,
            },
        }, ct);
        return slot.Date.ToString("yyyy-MM-dd");
    }

    private static string[] CandidateSlotIds(string slotId)
    {
        var trimmed = slotId.Trim();
        var ids = new List<string> { trimmed };
        if (!trimmed.StartsWith("SLT-", StringComparison.OrdinalIgnoreCase))
            ids.Add($"SLT-{trimmed}");

        var dateText = trimmed.StartsWith("SLT-", StringComparison.OrdinalIgnoreCase)
            ? trimmed[4..]
            : trimmed;
        if (TryNormalizeDate(dateText, out var normalized))
        {
            ids.Add(normalized);
            ids.Add($"SLT-{normalized}");
        }

        return ids
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static bool TryNormalizeDate(string value, out string normalized)
    {
        string[] formats = ["yyyy-MM-dd", "dd-MM-yyyy", "d-M-yyyy", "dd/MM/yyyy", "d/M/yyyy"];
        if (DateOnly.TryParseExact(
            value.Trim(),
            formats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed))
        {
            normalized = parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            return true;
        }

        normalized = "";
        return false;
    }

    // ── Follow-up ──────────────────────────────────────────────────────

    public async Task<JsonObject> GetFollowUpAsync(string applicantId, CancellationToken ct)
    {
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        if (draft["followUp"] is JsonObject followUp)
            return followUp;

        return new JsonObject
        {
            ["capacities"] = "pending",
            ["traits"] = "pending",
            ["sports"] = "pending",
            ["medical"] = "pending",
            ["investigation"] = "pending",
            ["finalResult"] = "pending",
        };
    }

    public async Task SaveFollowUpAsync(string applicantId, JsonObject data, CancellationToken ct)
    {
        // Merge only the known result keys to prevent arbitrary data injection.
        var allowed = new[] { "capacities", "traits", "sports", "medical", "investigation", "finalResult" };
        var existing = await GetFollowUpAsync(applicantId, ct);
        foreach (var key in allowed)
        {
            if (data[key] is { } val)
                existing[key] = val.DeepClone();
        }
        await SaveDraftAsync(applicantId, new JsonObject { ["followUp"] = existing }, ct);
    }

    // ── Family ─────────────────────────────────────────────────────────

    public async Task<JsonObject?> GetFamilyAsync(string applicantId, CancellationToken ct)
    {
        var record = await db.PortalRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Type == "family" && x.RecordId == applicantId, ct);
        return record is null ? null : ParseJson(record.PayloadJson);
    }

    public async Task<JsonObject> SaveFamilyAsync(
        string applicantId,
        JsonObject data,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var record = await db.PortalRecords
            .FirstOrDefaultAsync(x => x.Type == "family" && x.RecordId == applicantId, ct);

        if (record is null)
        {
            record = new ApplicantPortalRecordEntity
            {
                Type = "family",
                RecordId = applicantId,
                ApplicantId = applicantId,
                PayloadJson = data.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.PortalRecords.Add(record);
        }
        else
        {
            record.PayloadJson = data.ToJsonString(JsonOpts);
            record.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return ParseJson(record.PayloadJson);
    }

    // ── Reset (dev/test) ───────────────────────────────────────────────

    public async Task DeleteDraftAsync(string applicantId, CancellationToken ct)
    {
        var records = await db.PortalRecords
            .Where(x => x.ApplicantId == applicantId)
            .ToListAsync(ct);
        db.PortalRecords.RemoveRange(records);
        await db.SaveChangesAsync(ct);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private static void MergeJson(JsonObject target, JsonObject source)
    {
        foreach (var kv in source)
        {
            target[kv.Key] = kv.Value?.DeepClone();
        }
    }

    private static JsonObject ParseJson(string json)
    {
        try
        {
            return JsonNode.Parse(json) as JsonObject ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    private static string GenerateRef(string applicantId)
    {
        var hash = 2166136261u;
        foreach (var c in applicantId)
        {
            hash ^= (uint)c;
            hash *= 16777619;
        }
        return $"PAY-{2026}{(hash % 10_000_000_000):D10}";
    }

    private static string GenerateFawryCode(string applicantId, DateTimeOffset at)
    {
        var seed = (long)(applicantId.GetHashCode() ^ at.Hour);
        var code = Math.Abs(seed) % 90_000_000 + 10_000_000;
        return code.ToString();
    }
}
