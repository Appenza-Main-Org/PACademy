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
    private static readonly string[] AcquaintanceDocSectionKeys =
    [
        "personal",
        "applicantFamily",
        "parents",
        "grandparents",
        "siblings",
        "paternalRelatives",
        "maternalRelatives",
        "foreignAndCases",
    ];

    private static readonly IReadOnlyDictionary<int, string> ApplicantStageLabels = new Dictionary<int, string>
    {
        [1] = "تسجيل أولي",
        [2] = "التحقق من البيانات",
        [3] = "استكمال البيانات الشخصية",
        [4] = "بيانات المؤهل",
        [5] = "المراجعة",
        [6] = "سداد الرسوم",
        [7] = "بيانات الأسرة",
        [8] = "حجز الاختبارات",
        [9] = "طباعة بطاقة التردد",
        [10] = "المتابعة",
        [11] = "وثائق التعارف"
    };

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    private static readonly TimeZoneInfo EgyptTimeZone = ResolveEgyptTimeZone();

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
            EnsureStartedStage(draft);
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
            EnsureStartedStage(draft);
            draft["lastSavedAt"] = now.ToUnixTimeMilliseconds();
            record.PayloadJson = draft.ToJsonString(JsonOpts);
            record.UpdatedAt = now;
        }

        await UpsertApplicantManagementMirrorAsync(ParseJson(record.PayloadJson), now, ct);
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

    public async Task<(string IntentId, string RefNumber, string FawryCode, decimal Amount)> CreatePaymentIntentAsync(
        string applicantId,
        string method,
        decimal amount,
        CancellationToken ct)
    {
        var normalizedAmount = amount > 0 ? amount : 250m;
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
                ["amount"] = normalizedAmount,
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

        return (intentId, refNumber, fawryCode, normalizedAmount);
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
        decimal? amount = null;
        if (record is not null)
        {
            var payload = ParseJson(record.PayloadJson);
            payload["status"] = "success";
            payload["paidAt"] = paidAt;
            record.PayloadJson = payload.ToJsonString(JsonOpts);
            record.UpdatedAt = now;
            refNumber = record.RecordId;
            fawryCode = payload["fawryCode"]?.GetValue<string>();
            amount = payload["amount"]?.GetValue<decimal>();
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
        if (amount is not null) paymentNode["amount"] = amount.Value;
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

        EnsureExamDateBookable(slot.Date);

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
            .FirstOrDefaultAsync(x => candidateIds.Contains(x.Id), ct);

        DateOnly pickedDate = default;
        if (slot is null && !TryParseSlotDate(slotId, out pickedDate))
            throw new KeyNotFoundException($"موعد الاختبار '{slotId}' غير موجود");

        var resolvedSlotId = slot?.Id ?? $"SLT-{pickedDate:yyyy-MM-dd}";
        var resolvedDate = slot?.Date ?? pickedDate;
        var resolvedTime = slot?.Time ?? "08:00";
        var resolvedLocation = slot?.Location ?? "كلية الشرطة - مبنى الاختبارات - القاهرة";

        EnsureExamDateBookable(resolvedDate);

        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        await SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 8),
            ["examSlot"] = new JsonObject
            {
                ["slotId"] = resolvedSlotId,
                ["date"] = resolvedDate.ToString("yyyy-MM-dd"),
                ["time"] = resolvedTime,
                ["location"] = resolvedLocation,
            },
        }, ct);
        return resolvedDate.ToString("yyyy-MM-dd");
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

    private static bool TryParseSlotDate(string slotId, out DateOnly date)
    {
        var trimmed = slotId.Trim();
        var dateText = trimmed.StartsWith("SLT-", StringComparison.OrdinalIgnoreCase)
            ? trimmed[4..]
            : trimmed;
        if (TryNormalizeDate(dateText, out var normalized) &&
            DateOnly.TryParseExact(
                normalized,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out date))
        {
            return true;
        }

        date = default;
        return false;
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

    private static void EnsureExamDateBookable(DateOnly date)
    {
        if (date < ApplicantToday())
            throw new InvalidOperationException("هذا الموعد لم يعد متاحاً للحجز");
    }

    private static DateOnly ApplicantToday()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, EgyptTimeZone);
        return DateOnly.FromDateTime(now.DateTime);
    }

    private static TimeZoneInfo ResolveEgyptTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
        }
    }

    private async Task UpsertApplicantManagementMirrorAsync(
        JsonObject draft,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var applicantId = StringProp(draft, "applicantId");
        if (string.IsNullOrWhiteSpace(applicantId)) return;

        var payload = BuildApplicantManagementPayload(draft, now);
        var existing = await db.ApplicantManagementRecords
            .FirstOrDefaultAsync(x => x.Module == "applicants" && x.Id == applicantId, ct);

        if (existing is null)
        {
            db.ApplicantManagementRecords.Add(new ApplicantManagementRecordEntity
            {
                Module = "applicants",
                Id = applicantId,
                ApplicantId = applicantId,
                NationalId = FirstString(payload, "nationalId"),
                CycleId = FirstString(payload, "cycleId"),
                CommitteeId = FirstString(payload, "committeeId"),
                CategoryKey = FirstString(payload, "categoryKey"),
                Department = FirstString(payload, "department"),
                Status = FirstString(payload, "status"),
                Kind = FirstString(payload, "kind"),
                OccurredAt = now,
                PayloadJson = payload.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            });
            return;
        }

        existing.ApplicantId = applicantId;
        existing.NationalId = FirstString(payload, "nationalId");
        existing.CycleId = FirstString(payload, "cycleId");
        existing.CommitteeId = FirstString(payload, "committeeId");
        existing.CategoryKey = FirstString(payload, "categoryKey");
        existing.Department = FirstString(payload, "department");
        existing.Status = FirstString(payload, "status");
        existing.Kind = FirstString(payload, "kind");
        existing.OccurredAt = now;
        existing.PayloadJson = payload.ToJsonString(JsonOpts);
        existing.UpdatedAt = now;
    }

    private static JsonObject BuildApplicantManagementPayload(JsonObject draft, DateTimeOffset now)
    {
        var payload = draft.DeepClone().AsObject();
        var applicantId = StringProp(payload, "applicantId") ?? "";
        var profile = ObjectProp(payload, "profile");
        var auth = ObjectProp(payload, "auth");
        var payment = ObjectProp(payload, "payment");
        var examSlot = ObjectProp(payload, "examSlot");
        var stage = Math.Max(IntProp(payload, "furthestStage") ?? IntProp(payload, "stage") ?? 1, 1);

        payload["id"] = applicantId;
        payload["applicantId"] = applicantId;
        payload["stage"] = stage;
        payload["stageLabel"] = ApplicantStageLabels.TryGetValue(stage, out var label)
            ? label
            : "مرحلة غير محددة";
        payload["status"] = stage >= 8 ? "under-review" : "pending";
        payload["paymentStatus"] = payment is null ? "pending" : "paid";
        payload["source"] = "applicant-portal";
        payload["registeredAt"] ??= now.ToString("O");
        payload["updatedAt"] = now.ToString("O");

        SetIfPresent(payload, "nationalId", StringProp(profile, "nationalId") ?? StringProp(auth, "nationalId"));
        SetIfPresent(payload, "phoneNumber", StringProp(profile, "mobile") ?? StringProp(auth, "phoneNumber"));
        SetIfPresent(payload, "name", StringProp(profile, "fullName"));
        SetIfPresent(payload, "email", StringProp(profile, "email"));
        SetIfPresent(payload, "gender", StringProp(profile, "gender"));
        SetIfPresent(payload, "religion", StringProp(profile, "religion"));
        SetIfPresent(payload, "birthDate", StringProp(profile, "dateOfBirth"));
        SetIfPresent(payload, "birthGovernorate", StringProp(profile, "birthGovernorate"));
        SetIfPresent(payload, "birthDistrict", StringProp(profile, "birthDistrict"));
        SetIfPresent(payload, "certType", StringProp(profile, "certificateName") ?? StringProp(profile, "qualificationLevel"));
        SetIfPresent(payload, "firstExamDate", StringProp(examSlot, "date"));

        return payload;
    }

    private static void EnsureStartedStage(JsonObject draft)
    {
        if (!draft.ContainsKey("categoryKey")) return;
        var current = IntProp(draft, "furthestStage") ?? 0;
        if (current < 1) draft["furthestStage"] = 1;
    }

    private static JsonObject? ObjectProp(JsonObject? obj, string key) =>
        obj is not null && obj.TryGetPropertyValue(key, out var node) && node is JsonObject child ? child : null;

    private static int? IntProp(JsonObject obj, string key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        try
        {
            return Convert.ToInt32(node.GetValue<double>());
        }
        catch (Exception) when (node is JsonValue)
        {
            return int.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }

    private static string? StringProp(JsonObject? obj, string key)
    {
        if (obj is null || !obj.TryGetPropertyValue(key, out var node) || node is null) return null;
        try
        {
            return node.GetValue<string>()?.Trim();
        }
        catch (InvalidOperationException)
        {
            return node.ToString().Trim();
        }
    }

    private static string? FirstString(JsonObject payload, params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = StringProp(payload, key);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }

    private static void SetIfPresent(JsonObject payload, string key, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) payload[key] = value;
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
        // Preserve configured test identifiers used by the acquaintance-doc gate,
        // while still rejecting unrelated follow-up keys.
        var existing = await GetFollowUpAsync(applicantId, ct);
        foreach (var (key, node) in data)
        {
            if (string.IsNullOrWhiteSpace(key) || node is null) continue;
            if (!IsAllowedFollowUpKey(key)) continue;
            string? value;
            try { value = node.GetValue<string>(); }
            catch (InvalidOperationException) { value = node.ToString(); }
            if (!IsValidFollowUpOutcome(value)) continue;
            existing[key] = value;
        }
        await SaveDraftAsync(applicantId, new JsonObject { ["followUp"] = existing.DeepClone() }, ct);
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

    // ── Acquaintance document ─────────────────────────────────────────

    public async Task<JsonObject> GetAcquaintanceDocStatusAsync(string applicantId, CancellationToken ct)
    {
        var lifecycle = await EvaluateAcquaintanceDocLifecycleAsync(applicantId, ct);
        return lifecycle.Status;
    }

    public async Task<JsonObject> GetOrCreateAcquaintanceDocAsync(string applicantId, CancellationToken ct)
    {
        var lifecycle = await EvaluateAcquaintanceDocLifecycleAsync(applicantId, ct);
        if (!lifecycle.IsOpen && lifecycle.Doc is null)
        {
            return new JsonObject
            {
                ["status"] = lifecycle.Status,
                ["document"] = null,
            };
        }

        var doc = lifecycle.Doc ?? await InitializeAcquaintanceDocAsync(applicantId, lifecycle.CycleId, ct);
        await CloseAcquaintanceDocIfDueAsync(doc, lifecycle, ct);

        return new JsonObject
        {
            ["status"] = lifecycle.Status,
            ["document"] = await BuildAcquaintanceDocPayloadAsync(doc.Id, ct),
            ["lastAutosavedAt"] = doc.LastAutosavedAt?.ToUnixTimeMilliseconds(),
            ["version"] = doc.Version,
        };
    }

    public async Task<JsonObject> SaveAcquaintanceDocAsync(string applicantId, JsonObject partial, CancellationToken ct)
    {
        var lifecycle = await EvaluateAcquaintanceDocLifecycleAsync(applicantId, ct);
        if (!lifecycle.IsOpen)
            throw new ConflictException(
                lifecycle.IsClosed ? ErrorCodes.AcquaintanceDocClosed : ErrorCodes.AcquaintanceDocNotOpen,
                lifecycle.IsClosed
                    ? "تم غلق وثيقة التعارف ولا يمكن تعديلها."
                    : "وثيقة التعارف لم تُفتح بعد لهذا المتقدم.");

        var doc = lifecycle.Doc ?? await InitializeAcquaintanceDocAsync(applicantId, lifecycle.CycleId, ct);
        await CloseAcquaintanceDocIfDueAsync(doc, lifecycle, ct);
        if (doc.Status == "closed")
            throw new ConflictException(ErrorCodes.AcquaintanceDocClosed, "تم غلق وثيقة التعارف ولا يمكن تعديلها.");

        var changed = new JsonArray();
        var now = DateTimeOffset.UtcNow;
        foreach (var key in AcquaintanceDocSectionKeys)
        {
            if (partial[key] is not JsonObject section) continue;
            await UpsertAcquaintanceDocSectionAsync(doc.Id, key, section, now, ct);
            changed.Add(key);
        }

        if (changed.Count > 0)
        {
            doc.Version += 1;
            doc.LastAutosavedAt = now;
            doc.UpdatedAt = now;
            db.AcquaintanceDocRevisions.Add(new ApplicantAcquaintanceDocRevisionEntity
            {
                Id = $"adr-{Guid.NewGuid():N}",
                AcquaintanceDocId = doc.Id,
                Version = doc.Version,
                ChangeKind = "autosave",
                ChangedSectionKeysJson = changed.ToJsonString(JsonOpts),
                CreatedAt = now,
            });
            await db.SaveChangesAsync(ct);
        }

        return new JsonObject
        {
            ["status"] = await GetAcquaintanceDocStatusAsync(applicantId, ct),
            ["document"] = await BuildAcquaintanceDocPayloadAsync(doc.Id, ct),
            ["lastAutosavedAt"] = doc.LastAutosavedAt?.ToUnixTimeMilliseconds(),
            ["version"] = doc.Version,
        };
    }

    public async Task<JsonObject> GetPrintableAcquaintanceDocAsync(string applicantId, CancellationToken ct)
    {
        var lifecycle = await EvaluateAcquaintanceDocLifecycleAsync(applicantId, ct);
        if (!lifecycle.IsClosed || lifecycle.Doc is null)
            throw new ConflictException(ErrorCodes.AcquaintanceDocNotOpen, "لا يمكن طباعة وثيقة التعارف قبل غلقها.");

        return new JsonObject
        {
            ["status"] = lifecycle.Status,
            ["document"] = await BuildAcquaintanceDocPayloadAsync(lifecycle.Doc.Id, ct),
            ["version"] = lifecycle.Doc.Version,
        };
    }

    // ── Reset (dev/test) ───────────────────────────────────────────────

    public async Task DeleteDraftAsync(string applicantId, CancellationToken ct)
    {
        var records = await db.PortalRecords
            .Where(x => x.ApplicantId == applicantId)
            .ToListAsync(ct);
        db.PortalRecords.RemoveRange(records);
        var docs = await db.AcquaintanceDocs
            .Where(x => x.ApplicantId == applicantId)
            .ToListAsync(ct);
        db.AcquaintanceDocs.RemoveRange(docs);
        await db.SaveChangesAsync(ct);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private sealed record AcquaintanceLifecycle(
        string CycleId,
        bool IsOpen,
        bool IsClosed,
        ApplicantAcquaintanceDocEntity? Doc,
        JsonObject Status);

    private async Task<AcquaintanceLifecycle> EvaluateAcquaintanceDocLifecycleAsync(string applicantId, CancellationToken ct)
    {
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var cycleId = draft["cycleId"]?.GetValue<string>() ?? "CYC-2026-M";
        var settings = await ResolveAcquaintanceDocSettingsAsync(cycleId, ct);
        var doc = await db.AcquaintanceDocs
            .FirstOrDefaultAsync(x => x.CycleId == cycleId && x.ApplicantId == applicantId, ct);

        var openingTest = settings.OpeningTestKey;
        var openingPassed = string.IsNullOrWhiteSpace(openingTest) ||
            IsOutcomeSatisfied(draft, openingTest, settings.OpeningRequiredOutcome);
        var scheduleOpen = IsScheduleOpen(draft, settings);
        var isEnabled = settings.IsEnabled;
        var isOpen = isEnabled && (openingPassed || scheduleOpen);
        var closeDue = IsCloseDue(draft, settings);

        if (doc is not null && doc.Status == "closed" && !closeDue && isOpen)
        {
            await ReopenAcquaintanceDocIfAllowedAsync(doc, ct);
        }

        if (doc is not null && closeDue)
        {
            await CloseAcquaintanceDocIfDueAsync(doc, closeDue, ct);
        }

        var isClosed = doc?.Status == "closed" || closeDue;
        if (isClosed) isOpen = false;

        var reason = !isEnabled
            ? "disabled"
            : isClosed
                ? "closed_by_backend_rule"
                : isOpen
                    ? "open"
                    : "waiting_for_configured_test";

        var status = new JsonObject
        {
            ["cycleId"] = cycleId,
            ["status"] = isClosed ? "closed" : isOpen ? "open" : "not_open",
            ["isOpen"] = isOpen,
            ["isClosed"] = isClosed,
            ["isLocked"] = !isOpen,
            ["canEdit"] = isOpen,
            ["canPrint"] = isClosed,
            ["reason"] = reason,
            ["openingTestKey"] = openingTest,
            ["closingTestKey"] = settings.ClosingTestKey,
            ["closingMode"] = settings.ClosingMode,
            ["openedAt"] = doc?.OpenedAt?.ToUnixTimeMilliseconds(),
            ["closedAt"] = doc?.ClosedAt?.ToUnixTimeMilliseconds(),
            ["lastAutosavedAt"] = doc?.LastAutosavedAt?.ToUnixTimeMilliseconds(),
            ["version"] = doc?.Version ?? 0,
        };

        return new AcquaintanceLifecycle(cycleId, isOpen, isClosed, doc, status);
    }

    private async Task<AcquaintanceDocSettingsEntity> ResolveAcquaintanceDocSettingsAsync(string cycleId, CancellationToken ct)
    {
        var explicitSettings = await db.AcquaintanceDocSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CycleId == cycleId, ct);
        if (explicitSettings is not null) return explicitSettings;

        var general = await db.GeneralSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == "settings", ct);

        var now = DateTimeOffset.UtcNow;
        return new AcquaintanceDocSettingsEntity
        {
            Id = $"ads-{cycleId}",
            CycleId = cycleId,
            OpeningTestKey = general?.AcquaintanceDocumentsEntryResponsibleTestCode ?? "",
            OpeningRequiredOutcome = "passed",
            ClosingTestKey = general?.AcquaintanceDocumentsCloseResponsibleTestCode ?? "",
            ClosingMode = general?.AcquaintanceDocumentsCloseTiming ?? "after_test_passed",
            ClosingAt = null,
            IsEnabled = true,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    private async Task<ApplicantAcquaintanceDocEntity> InitializeAcquaintanceDocAsync(
        string applicantId,
        string cycleId,
        CancellationToken ct)
    {
        var existing = await db.AcquaintanceDocs
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.CycleId == cycleId && x.ApplicantId == applicantId, ct);
        if (existing is not null) return existing;

        var now = DateTimeOffset.UtcNow;
        var doc = new ApplicantAcquaintanceDocEntity
        {
            Id = $"adoc-{Guid.NewGuid():N}",
            CycleId = cycleId,
            ApplicantId = applicantId,
            Status = "open",
            OpenedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
            Version = 1,
        };
        db.AcquaintanceDocs.Add(doc);

        var initial = await BuildInitialAcquaintanceDocPayloadAsync(applicantId, cycleId, ct);
        foreach (var key in AcquaintanceDocSectionKeys)
        {
            var section = initial[key] as JsonObject ?? new JsonObject();
            db.AcquaintanceDocSections.Add(new ApplicantAcquaintanceDocSectionEntity
            {
                Id = $"adsx-{Guid.NewGuid():N}",
                AcquaintanceDocId = doc.Id,
                SectionKey = key,
                DataJson = section.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        await db.SaveChangesAsync(ct);
        return doc;
    }

    private async Task<JsonObject> BuildInitialAcquaintanceDocPayloadAsync(string applicantId, string cycleId, CancellationToken ct)
    {
        var draft = await GetOrCreateDraftAsync(applicantId, ct);
        var family = await GetFamilyAsync(applicantId, ct);
        var profile = draft["profile"] as JsonObject;
        var personal = new JsonObject
        {
            ["cover"] = new JsonObject
            {
                ["fullName"] = StringFrom(profile, "fullName"),
                ["fileNumber"] = applicantId,
                ["admissionYear"] = cycleId.Contains("2026", StringComparison.Ordinal) ? "2026" : "",
                ["committee"] = StringFrom(draft["examSlot"] as JsonObject, "location"),
                ["governorate"] = StringFrom(profile, "birthGovernorate"),
            },
            ["personal"] = new JsonObject
            {
                ["fullName"] = StringFrom(profile, "fullName"),
                ["fileNumber"] = applicantId,
                ["shuhraName"] = "",
                ["committee"] = StringFrom(draft["examSlot"] as JsonObject, "location"),
                ["dateOfBirth"] = StringFrom(profile, "dateOfBirth"),
                ["nationality"] = "مصرية",
                ["governorate"] = StringFrom(profile, "birthGovernorate"),
                ["birthPlace"] = StringFrom(profile, "birthDistrict"),
                ["religion"] = StringFrom(profile, "religion"),
                ["nationalId"] = StringFrom(profile, "nationalId"),
                ["qualificationOrTrack"] = StringFrom(profile, "certificateName"),
                ["qualificationYear"] = "",
                ["totalGrades"] = "",
                ["gradesPercent"] = "",
                ["homePhone"] = "",
                ["mobile"] = StringFrom(profile, "mobile"),
                ["maritalStatus"] = "",
                ["address"] = "",
            },
        };

        return new JsonObject
        {
            ["section"] = "general",
            ["personal"] = personal,
            ["applicantFamily"] = new JsonObject(),
            ["parents"] = family is null ? new JsonObject() : family.DeepClone(),
            ["grandparents"] = new JsonObject(),
            ["siblings"] = new JsonObject(),
            ["paternalRelatives"] = new JsonObject(),
            ["maternalRelatives"] = new JsonObject(),
            ["foreignAndCases"] = new JsonObject(),
        };
    }

    private async Task<JsonObject> BuildAcquaintanceDocPayloadAsync(string docId, CancellationToken ct)
    {
        var sections = await db.AcquaintanceDocSections
            .AsNoTracking()
            .Where(x => x.AcquaintanceDocId == docId)
            .ToListAsync(ct);
        var payload = new JsonObject { ["section"] = "general" };
        foreach (var key in AcquaintanceDocSectionKeys)
        {
            var section = sections.FirstOrDefault(x => x.SectionKey == key);
            payload[key] = section is null ? new JsonObject() : ParseJson(section.DataJson);
        }
        return payload;
    }

    private async Task UpsertAcquaintanceDocSectionAsync(
        string docId,
        string key,
        JsonObject section,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var row = await db.AcquaintanceDocSections
            .FirstOrDefaultAsync(x => x.AcquaintanceDocId == docId && x.SectionKey == key, ct);
        if (row is null)
        {
            db.AcquaintanceDocSections.Add(new ApplicantAcquaintanceDocSectionEntity
            {
                Id = $"adsx-{Guid.NewGuid():N}",
                AcquaintanceDocId = docId,
                SectionKey = key,
                DataJson = section.ToJsonString(JsonOpts),
                CreatedAt = now,
                UpdatedAt = now,
            });
            return;
        }

        row.DataJson = section.ToJsonString(JsonOpts);
        row.UpdatedAt = now;
    }

    private async Task CloseAcquaintanceDocIfDueAsync(
        ApplicantAcquaintanceDocEntity doc,
        AcquaintanceLifecycle lifecycle,
        CancellationToken ct)
    {
        await CloseAcquaintanceDocIfDueAsync(doc, lifecycle.IsClosed, ct);
    }

    private async Task CloseAcquaintanceDocIfDueAsync(
        ApplicantAcquaintanceDocEntity doc,
        bool closeDue,
        CancellationToken ct)
    {
        if (!closeDue || doc.Status == "closed") return;
        var now = DateTimeOffset.UtcNow;
        doc.Status = "closed";
        doc.ClosedAt = now;
        doc.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
    }

    private async Task ReopenAcquaintanceDocIfAllowedAsync(
        ApplicantAcquaintanceDocEntity doc,
        CancellationToken ct)
    {
        if (doc.Status != "closed") return;
        doc.Status = "open";
        doc.ClosedAt = null;
        doc.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static bool IsScheduleOpen(JsonObject draft, AcquaintanceDocSettingsEntity settings)
    {
        if (settings.ClosingMode == "after_test_passed") return false;
        return false;
    }

    private static bool IsCloseDue(JsonObject draft, AcquaintanceDocSettingsEntity settings)
    {
        if (settings.ClosingAt is { } closingAt && DateTimeOffset.UtcNow >= closingAt) return true;
        if (settings.ClosingMode == "after_test_passed" &&
            !string.IsNullOrWhiteSpace(settings.ClosingTestKey) &&
            IsOutcomeSatisfied(draft, settings.ClosingTestKey, "passed"))
        {
            return true;
        }

        var examDate = DateForConfiguredTestFromDraft(draft, settings.ClosingTestKey);
        if (examDate is null) return false;
        var due = settings.ClosingMode switch
        {
            "before_test" => examDate.Value - TimeSpan.FromDays(1),
            "on_test_time" => examDate.Value,
            _ => (DateTimeOffset?)null,
        };
        return due is not null && DateTimeOffset.UtcNow >= due;
    }

    private static DateTimeOffset? DateForConfiguredTestFromDraft(JsonObject draft, string testKey)
    {
        var scheduled = DateFromScheduledTests(draft, testKey);
        if (scheduled is not null) return scheduled;

        // The draft's examSlot is the first applicant-picked exam date only.
        // Do not use it for later configured tests such as external traits;
        // otherwise وثيقة التعارف closes before that test has even started.
        return IsFirstExamTestKey(testKey) ? DateFromDraft(draft) : null;
    }

    private static DateTimeOffset? DateFromScheduledTests(JsonObject draft, string testKey)
    {
        if (string.IsNullOrWhiteSpace(testKey)) return null;
        var candidates = CandidateTestKeys(testKey).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var arrayKey in new[] { "testSchedules", "tests", "examSchedules", "examResults" })
        {
            if (draft[arrayKey] is not JsonArray schedules) continue;
            foreach (var node in schedules)
            {
                if (node is not JsonObject schedule) continue;
                if (!ScheduleMatchesTest(schedule, candidates)) continue;
                var parsed = DateFromSchedule(schedule);
                if (parsed is not null) return parsed;
            }
        }
        return null;
    }

    private static bool ScheduleMatchesTest(JsonObject schedule, HashSet<string> candidates)
    {
        foreach (var key in new[] { "testKey", "testCode", "code", "kind", "examId", "id" })
        {
            var value = schedule[key]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(value) && candidates.Contains(value)) return true;
        }
        return false;
    }

    private static DateTimeOffset? DateFromSchedule(JsonObject schedule)
    {
        foreach (var key in new[] { "scheduledAt", "startsAt", "examDateTime", "dateTime" })
        {
            var value = schedule[key]?.GetValue<string>();
            if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
                return dto;
        }

        foreach (var key in new[] { "date", "examDate", "scheduledDate" })
        {
            var value = schedule[key]?.GetValue<string>();
            var time = schedule["time"]?.GetValue<string>() ?? schedule["scheduledTime"]?.GetValue<string>();
            var parsed = DateFromParts(value, time);
            if (parsed is not null) return parsed;
        }

        return null;
    }

    private static DateTimeOffset? DateFromDraft(JsonObject draft)
    {
        var dateText = draft["examSlot"]?["date"]?.GetValue<string>();
        var timeText = draft["examSlot"]?["time"]?.GetValue<string>();
        return DateFromParts(dateText, timeText);
    }

    private static DateTimeOffset? DateFromParts(string? dateText, string? timeText)
    {
        if (!DateOnly.TryParse(dateText, out var date)) return null;
        var time = TimeOnly.MinValue;
        if (!string.IsNullOrWhiteSpace(timeText))
            _ = TimeOnly.TryParse(timeText, out time);
        return new DateTimeOffset(date.ToDateTime(time), TimeSpan.Zero);
    }

    private static bool IsOutcomeSatisfied(JsonObject draft, string testKey, string requiredOutcome)
    {
        var followUp = draft["followUp"] as JsonObject;
        if (followUp is null) return false;
        var normalizedRequired = NormalizeOutcome(requiredOutcome);
        foreach (var key in CandidateTestKeys(testKey))
        {
            var value = followUp[key]?.GetValue<string>();
            if (NormalizeOutcome(value) == normalizedRequired) return true;
        }
        return false;
    }

    private static string NormalizeOutcome(string? value) => value switch
    {
        "pass" => "passed",
        "passed" => "passed",
        "success" => "passed",
        _ => value ?? "",
    };

    private static bool IsValidFollowUpOutcome(string? value) => NormalizeOutcome(value) is
        "pending" or "in-progress" or "awaiting-approval" or "passed" or "failed";

    private static bool IsAllowedFollowUpKey(string key) =>
        key.StartsWith("TST-", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("AX-", StringComparison.OrdinalIgnoreCase) ||
        KnownFollowUpKeys.Contains(key);

    private static readonly HashSet<string> KnownFollowUpKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "capacities",
        "traits",
        "sports",
        "medical",
        "investigation",
        "finalResult",
        "aptitude",
        "appearance_external",
        "appearance_internal",
        "posture",
        "build",
        "physical",
        "security_review",
        "psychology",
        "medical_advanced",
    };

    private static IEnumerable<string> CandidateTestKeys(string key)
    {
        if (!string.IsNullOrWhiteSpace(key)) yield return key;
        var legacy = MapLegacyFollowUpKey(key);
        if (!string.IsNullOrWhiteSpace(legacy)) yield return legacy;
    }

    private static bool IsFirstExamTestKey(string key) =>
        CandidateTestKeys(key).Any(candidate =>
            string.Equals(candidate, "TST-01", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(candidate, "AX-01", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(candidate, "aptitude", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(candidate, "capacities", StringComparison.OrdinalIgnoreCase));

    private static string MapLegacyFollowUpKey(string key) => key switch
    {
        "AX-01" => "capacities",
        "TST-01" => "capacities",
        "TST-02" => "traits",
        "TST-03" => "traits",
        "TST-04" => "traits",
        "TST-05" => "traits",
        "TST-06" => "sports",
        "TST-07" => "medical",
        "TST-08" => "traits",
        "TST-09" => "traits",
        "aptitude" => "capacities",
        "appearance_external" => "traits",
        "appearance_internal" => "traits",
        "posture" => "traits",
        "build" => "traits",
        "physical" => "sports",
        "security_review" => "investigation",
        _ => key,
    };

    private static string StringFrom(JsonObject? obj, string key)
    {
        if (obj is null || obj[key] is null) return "";
        try { return obj[key]!.GetValue<string>() ?? ""; }
        catch { return obj[key]!.ToString(); }
    }

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
