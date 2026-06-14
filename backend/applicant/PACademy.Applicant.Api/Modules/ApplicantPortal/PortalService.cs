using System.Text.Json;
using System.Text.Json.Nodes;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PACademy.Shared.Contracts;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

/// <summary>
/// All applicant-portal business logic: draft CRUD, stage commits,
/// payment, exam-slot reservation, family approval, follow-up.
/// Keeps each concern as a private method; controller delegates here.
/// </summary>
public sealed class PortalService(PortalDbContext db, ILogger<PortalService> logger)
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
            ClearCommitteeAssignmentOnCategoryChange(draft, partial);
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

    public async Task<string> PickExamDateAsync(
        string applicantId,
        string slotId,
        PickedCommittee? committee,
        CancellationToken ct)
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
        var resolvedCommittee = await ResolveBookableCommitteeAsync(draft, resolvedDate, committee, ct);
        var current = draft["furthestStage"]?.GetValue<int>() ?? 0;
        var examSlot = new JsonObject
        {
            ["slotId"] = resolvedSlotId,
            ["date"] = resolvedDate.ToString("yyyy-MM-dd"),
            ["time"] = resolvedTime,
            ["location"] = resolvedLocation,
        };
        var patch = new JsonObject
        {
            ["furthestStage"] = Math.Max(current, 8),
            ["examSlot"] = examSlot,
        };
        ApplyPickedCommittee(patch, examSlot, resolvedCommittee);
        await EnsureBarcodeAsync(applicantId, draft, resolvedCommittee, patch, ct);
        await SaveDraftAsync(applicantId, patch, ct);
        return resolvedDate.ToString("yyyy-MM-dd");
    }

    /// <summary>
    /// The committee the client suggests is only a hint — the stored
    /// assignment must belong to the applicant's chosen category. The picked
    /// date is validated against the admin-authored committee instances for
    /// (cycle × category × date); when the suggestion is not in that set the
    /// committee is re-resolved server-side, and dates with no instance for
    /// the applicant's category are rejected outright.
    /// </summary>
    private async Task<PickedCommittee> ResolveBookableCommitteeAsync(
        JsonObject draft,
        DateOnly date,
        PickedCommittee? requested,
        CancellationToken ct)
    {
        var categoryKey = StringProp(draft, "categoryKey");
        if (string.IsNullOrWhiteSpace(categoryKey))
            throw new ConflictException(
                "CATEGORY_REQUIRED",
                "يجب اختيار فئة التقديم قبل حجز موعد الاختبار");

        var cycleId = StringProp(draft, "cycleId") ?? "CYC-2026-M";
        var codes = await db.CommitteeInstances
            .AsNoTracking()
            .Where(x => x.CycleId == cycleId && x.CategoryKey == categoryKey && x.Date == date)
            .Select(x => x.DefinitionCode)
            .Distinct()
            .ToListAsync(ct);
        if (codes.Count == 0)
            throw new ConflictException(
                "EXAM_DATE_NOT_AVAILABLE_FOR_CATEGORY",
                "موعد الاختبار المحدد غير متاح لفئة التقديم الخاصة بك");

        var nameByCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var lookupRows = await db.CommitteeLookups
            .AsNoTracking()
            .Where(x => x.LookupKey == "committees" && codes.Contains(x.Code))
            .ToListAsync(ct);
        foreach (var row in lookupRows) nameByCode[row.Code] = row.Name;

        var requestedId = requested?.CommitteeId?.Trim();
        var code = requestedId is not null && codes.Contains(requestedId, StringComparer.OrdinalIgnoreCase)
            ? requestedId
            : PickCommitteeForGender(codes, nameByCode, StringProp(ObjectProp(draft, "profile"), "gender"));
        var name = nameByCode.GetValueOrDefault(code)
            ?? (string.Equals(code, requestedId, StringComparison.OrdinalIgnoreCase) ? requested?.CommitteeName : null)
            ?? code;
        return new PickedCommittee(code, name);
    }

    /// <summary>
    /// Committee gender is encoded in the Arabic display name — «طالبات»
    /// marks female committees (same convention the admin name-resolution
    /// relies on). Prefers a gender-matching committee, falls back to the
    /// first code in deterministic order.
    /// </summary>
    private static string PickCommitteeForGender(
        IReadOnlyList<string> codes,
        IReadOnlyDictionary<string, string> nameByCode,
        string? gender)
    {
        var ordered = codes.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList();
        var isFemale = string.Equals(gender, "female", StringComparison.OrdinalIgnoreCase);
        var genderMatched = ordered
            .Where(code => nameByCode.TryGetValue(code, out var name) &&
                name.Contains("طالبات", StringComparison.Ordinal) == isFemale)
            .ToList();
        return (genderMatched.Count > 0 ? genderMatched : ordered)[0];
    }

    private static void ApplyPickedCommittee(
        JsonObject patch,
        JsonObject examSlot,
        PickedCommittee committee)
    {
        if (!string.IsNullOrWhiteSpace(committee.CommitteeId))
        {
            patch["assignedCommitteeId"] = committee.CommitteeId;
            examSlot["committeeId"] = committee.CommitteeId;
        }
        if (!string.IsNullOrWhiteSpace(committee.CommitteeName))
        {
            patch["assignedCommitteeName"] = committee.CommitteeName;
            examSlot["committeeName"] = committee.CommitteeName;
        }
    }

    // ── Barcode ────────────────────────────────────────────────────────

    /// <summary>
    /// Issues the applicant's permanent barcode the first time an exam
    /// committee is assigned (the post-payment trigger). Format
    /// <c>YY BYY MM DD G CC SSSSS</c> (16 digits): intake year, birth yy/mm/dd,
    /// gender (male=1 / female=2), committee code (trailing digits) and a
    /// per-(cycle × committee) sequential number. The value is written exactly
    /// once — a later re-pick or payment reversal never changes it. Missing
    /// prerequisites are a silent skip; an allocation failure is logged and
    /// flags the draft for retry (acceptance criterion 4) without blocking the
    /// booking. The patch is persisted by the caller's SaveDraftAsync.
    /// </summary>
    private async Task EnsureBarcodeAsync(
        string applicantId,
        JsonObject draft,
        PickedCommittee committee,
        JsonObject patch,
        CancellationToken ct)
    {
        // Immutable once issued.
        if (!string.IsNullOrWhiteSpace(StringProp(draft, "barcode"))) return;

        var paid = ObjectProp(draft, "payment") is { } payment && payment.ContainsKey("paidAt");
        var profile = ObjectProp(draft, "profile");
        var dob = StringProp(profile, "dateOfBirth");
        var gender = StringProp(profile, "gender");
        var committeeCode = committee.CommitteeId?.Trim();
        var cycleId = StringProp(draft, "cycleId") ?? "CYC-2026-M";

        if (!paid
            || !TryBuildBirthSegments(dob, out var byy, out var mm, out var dd)
            || GenderDigit(gender) is not { } g
            || string.IsNullOrWhiteSpace(committeeCode)
            || CommitteeDigits(committeeCode) is not { } cc)
        {
            logger.LogWarning(
                "Skipping barcode for applicant {ApplicantId}: paid={Paid}, hasDob={HasDob}, hasGender={HasGender}, committee={Committee}",
                applicantId, paid, dob is not null, gender is not null, committeeCode);
            return;
        }

        try
        {
            var sequence = await AllocateSequenceAsync(cycleId, committeeCode, ct);
            patch["barcode"] = FormatBarcode(IntakeYearDigits(cycleId), byy, mm, dd, g, cc, sequence);
            patch["barcodeGeneratedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            patch["barcodeRetry"] = false;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // A genuine failure (e.g. exhausted allocation retries) is logged and
            // flagged for retry without blocking the booking. Request cancellation
            // must propagate, not be recorded as a barcode failure.
            logger.LogError(ex, "Failed to generate barcode for applicant {ApplicantId}", applicantId);
            patch["barcodeRetry"] = true;
        }
    }

    /// <summary>
    /// Atomically allocates the next 1-based sequence for a (cycle × committee)
    /// pair. The row is created on first use; concurrent allocations that lose
    /// the RowVersion/insert race are retried. A consumed number is never
    /// returned to the pool, so a reversed payment cannot reassign it.
    /// </summary>
    private async Task<int> AllocateSequenceAsync(string cycleId, string committeeCode, CancellationToken ct)
    {
        const int maxAttempts = 5;
        for (var attempt = 1; ; attempt++)
        {
            var now = DateTimeOffset.UtcNow;
            var row = await db.BarcodeSequences
                .FirstOrDefaultAsync(x => x.CycleId == cycleId && x.CommitteeCode == committeeCode, ct);

            int allocated;
            if (row is null)
            {
                allocated = 1;
                db.BarcodeSequences.Add(new BarcodeSequenceEntity
                {
                    CycleId = cycleId,
                    CommitteeCode = committeeCode,
                    NextSequence = 2,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }
            else
            {
                allocated = row.NextSequence;
                row.NextSequence += 1;
                row.UpdatedAt = now;
            }

            try
            {
                await db.SaveChangesAsync(ct);
                return allocated;
            }
            catch (DbUpdateException) when (attempt < maxAttempts)
            {
                // Lost the race — drop the stale tracked rows and re-read.
                foreach (var entry in db.ChangeTracker.Entries<BarcodeSequenceEntity>().ToList())
                    entry.State = EntityState.Detached;
            }
        }
    }

    private static string IntakeYearDigits(string? cycleId)
    {
        // "CYC-2026-M" → "26". Fall back to the current Gregorian year.
        var match = Regex.Match(cycleId ?? "", @"\d{4}");
        var year = match.Success ? int.Parse(match.Value, CultureInfo.InvariantCulture) : DateTimeOffset.UtcNow.Year;
        return (year % 100).ToString("D2", CultureInfo.InvariantCulture);
    }

    private static bool TryBuildBirthSegments(string? dob, out string byy, out string mm, out string dd)
    {
        byy = mm = dd = "";
        if (string.IsNullOrWhiteSpace(dob)) return false;
        if (!DateOnly.TryParseExact(dob, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            && !DateOnly.TryParse(dob, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
            return false;
        byy = (date.Year % 100).ToString("D2", CultureInfo.InvariantCulture);
        mm = date.Month.ToString("D2", CultureInfo.InvariantCulture);
        dd = date.Day.ToString("D2", CultureInfo.InvariantCulture);
        return true;
    }

    private static string? GenderDigit(string? gender) => gender?.Trim().ToLowerInvariant() switch
    {
        "male" or "m" or "ذكر" => "1",
        "female" or "f" or "أنثى" => "2",
        _ => null,
    };

    private static string? CommitteeDigits(string? committeeCode)
    {
        // CC = the trailing digit run, last 2 digits, zero-padded.
        // "CMT-12" → "12", "CMT-LAW-2" → "02", "COM-GEN-01" → "01".
        var match = Regex.Match(committeeCode ?? "", @"(\d+)\s*$");
        if (!match.Success) return null;
        var digits = match.Groups[1].Value;
        return (digits.Length <= 2 ? digits : digits[^2..]).PadLeft(2, '0');
    }

    private static string FormatBarcode(string yy, string byy, string mm, string dd, string g, string cc, int sequence)
    {
        var sssss = (sequence % 100_000).ToString("D5", CultureInfo.InvariantCulture);
        return $"{yy}{byy}{mm}{dd}{g}{cc}{sssss}";
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
                CommitteeId = FirstString(payload, "committeeId", "assignedCommitteeId"),
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
        existing.CommitteeId = FirstString(payload, "committeeId", "assignedCommitteeId");
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

    /// <summary>
    /// A booked exam slot and its committee are only valid for the category
    /// they were booked under — switching category invalidates them, so the
    /// stale assignment is dropped instead of surviving the merge.
    /// </summary>
    private static void ClearCommitteeAssignmentOnCategoryChange(JsonObject draft, JsonObject partial)
    {
        var nextCategory = StringProp(partial, "categoryKey");
        var currentCategory = StringProp(draft, "categoryKey");
        if (string.IsNullOrWhiteSpace(nextCategory) || string.IsNullOrWhiteSpace(currentCategory)) return;
        if (string.Equals(nextCategory, currentCategory, StringComparison.OrdinalIgnoreCase)) return;

        draft.Remove("examSlot");
        draft.Remove("assignedCommitteeId");
        draft.Remove("assignedCommitteeName");
        draft.Remove("firstExamDate");
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

    /// <summary>
    /// The fully-resolved open/close rule for the acquaintance document, derived
    /// from the admin general-settings singleton (timing + offsets) layered with
    /// the optional per-cycle override (test keys / enabled / explicit closing-at).
    /// <see cref="OpeningMode"/> / <see cref="ClosingMode"/> are one of
    /// <c>before_test</c>, <c>on_test_time</c>, <c>after_test_passed</c>.
    /// </summary>
    private sealed record ResolvedAcquaintanceSettings(
        bool IsEnabled,
        string OpeningTestKey,
        string OpeningRequiredOutcome,
        string OpeningMode,
        TimeSpan OpeningOffset,
        string ClosingTestKey,
        string ClosingMode,
        TimeSpan ClosingOffset,
        DateTimeOffset? ClosingAt);

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

    private async Task<ResolvedAcquaintanceSettings> ResolveAcquaintanceDocSettingsAsync(string cycleId, CancellationToken ct)
    {
        var general = await db.GeneralSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == "settings", ct);

        var explicitSettings = await db.AcquaintanceDocSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CycleId == cycleId, ct);

        // Test keys / enabled / explicit closing-at come from the optional per-cycle
        // override when present; opening & closing TIMING + OFFSET always derive from
        // the admin general-settings singleton (the override table never carried them,
        // which is why an admin-configured open timing previously had no effect).
        var openingTest = explicitSettings?.OpeningTestKey;
        if (string.IsNullOrWhiteSpace(openingTest))
            openingTest = general?.AcquaintanceDocumentsEntryResponsibleTestCode;

        var closingTest = explicitSettings?.ClosingTestKey;
        if (string.IsNullOrWhiteSpace(closingTest))
            closingTest = general?.AcquaintanceDocumentsCloseResponsibleTestCode;

        return new ResolvedAcquaintanceSettings(
            IsEnabled: explicitSettings?.IsEnabled ?? true,
            OpeningTestKey: openingTest ?? "",
            OpeningRequiredOutcome: explicitSettings?.OpeningRequiredOutcome ?? "passed",
            OpeningMode: NormalizeTiming(general?.AcquaintanceDocumentsOpenTiming, "after_test_passed"),
            OpeningOffset: OffsetToTimeSpan(
                general?.AcquaintanceDocumentsOpenOffsetValue,
                general?.AcquaintanceDocumentsOpenOffsetUnit),
            ClosingTestKey: closingTest ?? "",
            ClosingMode: NormalizeTiming(
                general?.AcquaintanceDocumentsCloseTiming ?? explicitSettings?.ClosingMode,
                "after_test_passed"),
            ClosingOffset: OffsetToTimeSpan(
                general?.AcquaintanceDocumentsCloseOffsetValue,
                general?.AcquaintanceDocumentsCloseOffsetUnit),
            ClosingAt: explicitSettings?.ClosingAt);
    }

    /// <summary>Validates a configured timing token, falling back when unrecognized/empty.</summary>
    private static string NormalizeTiming(string? value, string fallback) => value switch
    {
        "before_test" => "before_test",
        "on_test_time" => "on_test_time",
        "after_test_passed" => "after_test_passed",
        _ => fallback,
    };

    /// <summary>Converts an admin offset (value + "days"/"hours" unit) into a span; 0 when unset.</summary>
    private static TimeSpan OffsetToTimeSpan(int? value, string? unit)
    {
        var magnitude = value.GetValueOrDefault(0);
        if (magnitude <= 0) return TimeSpan.Zero;
        return string.Equals(unit, "hours", StringComparison.OrdinalIgnoreCase)
            ? TimeSpan.FromHours(magnitude)
            : TimeSpan.FromDays(magnitude);
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
        // Stage 7 persists the family blob into the draft (`draft.family`) via
        // SaveDraftAsync — NOT into the dedicated "family" PortalRecord. Read the
        // draft first; fall back to the standalone record for legacy data.
        var family = draft["family"] as JsonObject ?? await GetFamilyAsync(applicantId, ct);
        var profile = draft["profile"] as JsonObject;
        var committeeName = CommitteeNameFromDraft(draft);

        // The وثيقة تعارف is a review-and-complete step: every personal /
        // identity field the applicant already submitted during registration
        // is reused here (and locked on the frontend). Pull the remaining
        // education / residence / contact fields from the saved draft profile
        // so the document never asks for data the applicant already provided.
        var qualificationOrTrack = FirstNonEmpty(
            StringFrom(profile, "certificateName"),
            StringFrom(profile, "thanawiType"));
        var qualificationYear = FirstNonEmpty(
            YearFromValue(StringFrom(profile, "thanawiGradDate")),
            StringFrom(profile, "bachelorYear"));
        var totalGrades = StringFrom(profile, "thanawiTotal");
        var gradesPercent = FirstNonEmpty(
            StringFrom(profile, "thanawiPercentage"),
            StringFrom(profile, "bachelorPercentage"));
        var address = FirstNonEmpty(
            StringFrom(profile, "currentAddressDetail"),
            StringFrom(profile, "address"));

        var personal = new JsonObject
        {
            ["cover"] = new JsonObject
            {
                ["fullName"] = StringFrom(profile, "fullName"),
                ["fileNumber"] = applicantId,
                ["admissionYear"] = cycleId.Contains("2026", StringComparison.Ordinal) ? "2026" : "",
                ["committee"] = committeeName,
                ["governorate"] = StringFrom(profile, "birthGovernorate"),
            },
            ["personal"] = new JsonObject
            {
                ["fullName"] = StringFrom(profile, "fullName"),
                ["fileNumber"] = applicantId,
                ["shuhraName"] = StringFrom(profile, "shuhra"),
                ["committee"] = committeeName,
                ["dateOfBirth"] = StringFrom(profile, "dateOfBirth"),
                ["nationality"] = "مصرية",
                ["governorate"] = StringFrom(profile, "birthGovernorate"),
                ["birthPlace"] = StringFrom(profile, "birthDistrict"),
                ["religion"] = StringFrom(profile, "religion"),
                ["nationalId"] = StringFrom(profile, "nationalId"),
                ["qualificationOrTrack"] = qualificationOrTrack,
                ["qualificationYear"] = qualificationYear,
                ["totalGrades"] = totalGrades,
                ["gradesPercent"] = gradesPercent,
                ["homePhone"] = StringFrom(profile, "homePhone"),
                ["mobile"] = StringFrom(profile, "mobile"),
                ["maritalStatus"] = StringFrom(profile, "maritalStatus"),
                ["address"] = address,
            },
        };

        return new JsonObject
        {
            ["section"] = "general",
            ["personal"] = personal,
            ["applicantFamily"] = new JsonObject(),
            ["parents"] = BuildParentsSectionFromFamily(family),
            ["grandparents"] = BuildGrandparentsSectionFromFamily(family),
            ["siblings"] = new JsonObject(),
            ["paternalRelatives"] = new JsonObject(),
            ["maternalRelatives"] = new JsonObject(),
            ["foreignAndCases"] = new JsonObject(),
        };
    }

    /* ── Family prefill (mirrors frontend vothiqaTaaruf.derive.ts) ──────────
     * The Stage-7 family snapshot stores each member in the FamilyMemberForm
     * shape (split firstName/secondName/thirdName, birthGovernorate/District,
     * residence*, qualificationDetail/professionDetail). The وثيقة تعارف
     * sections use the FatherRecord/MotherRecord/GrandparentRecord/Guardian
     * shapes (joined fullName, birthPlace, workplace/workNature, address).
     * These mappers translate one to the other so previously-entered family
     * data is reflected in the acquaintance document. Scope matches the
     * frontend derive: parents + guardian + grandparents (siblings/relatives
     * are collected fresh in the document, which captures more detail). */

    private static JsonObject BuildParentsSectionFromFamily(JsonObject? family)
    {
        var parents = new JsonObject();
        if (family is null) return parents;

        if (ObjectProp(family, "father") is { } father)
        {
            var firstWife = (family["fatherWives"] as JsonArray) is { Count: > 0 } wives
                ? wives[0] as JsonObject
                : null;
            parents["father"] = MapFatherRecord(father, firstWife);
        }
        if (ObjectProp(family, "mother") is { } mother)
        {
            var firstHusband = (family["motherHusbands"] as JsonArray) is { Count: > 0 } husbands
                ? husbands[0] as JsonObject
                : null;
            parents["mother"] = MapMotherRecord(mother, firstHusband);
        }
        if (MapGuardianRecord(ObjectProp(family, "guardian")) is { } guardian)
        {
            parents["guardian"] = guardian;
        }
        return parents;
    }

    private static JsonObject BuildGrandparentsSectionFromFamily(JsonObject? family)
    {
        var section = new JsonObject();
        if (ObjectProp(family, "grandparents") is not { } grandparents) return section;
        foreach (var slot in new[]
                 {
                     "paternalGrandfather", "paternalGrandmother",
                     "maternalGrandfather", "maternalGrandmother",
                 })
        {
            if (ObjectProp(grandparents, slot) is { } member)
            {
                section[slot] = MapGrandparentRecord(member);
            }
        }
        return section;
    }

    private static JsonObject MapFatherRecord(JsonObject father, JsonObject? firstWife)
    {
        var record = new JsonObject
        {
            ["fullName"] = FamilyMemberName(father),
            ["shuhraName"] = StringFrom(father, "shuhra"),
            ["dateOfBirth"] = StringFrom(father, "dateOfBirth"),
            ["birthPlace"] = JoinWithDash(StringFrom(father, "birthDistrict"), StringFrom(father, "birthGovernorate")),
            ["qualification"] = StringFrom(father, "qualification"),
            ["profession"] = StringFrom(father, "profession"),
            ["seniorityNumber"] = StringFrom(father, "seniorityNumber"),
            ["workplace"] = StringFrom(father, "professionDetail"),
            ["workNature"] = StringFrom(father, "qualificationDetail"),
            ["address"] = JoinWithDash(
                StringFrom(father, "residenceDetail"),
                StringFrom(father, "residenceDistrict"),
                StringFrom(father, "residenceGovernorate")),
            ["nationalId"] = StringFrom(father, "nationalId"),
            ["deceased"] = BoolFrom(father, "deceased"),
        };
        if (firstWife is not null)
        {
            record["hasCurrentWife"] = true;
            record["currentWifeCount"] = "1";
            record["currentWife"] = MapSpouseSubRecord(firstWife);
        }
        return record;
    }

    private static JsonObject MapMotherRecord(JsonObject mother, JsonObject? firstHusband)
    {
        var record = new JsonObject
        {
            ["fullName"] = FamilyMemberName(mother),
            ["dateOfBirth"] = StringFrom(mother, "dateOfBirth"),
            ["birthPlace"] = JoinWithDash(StringFrom(mother, "birthDistrict"), StringFrom(mother, "birthGovernorate")),
            ["qualification"] = StringFrom(mother, "qualification"),
            ["religion"] = StringFrom(mother, "religion"),
            ["profession"] = StringFrom(mother, "profession"),
            ["seniorityNumber"] = StringFrom(mother, "seniorityNumber"),
            ["workplace"] = StringFrom(mother, "professionDetail"),
            ["workNature"] = StringFrom(mother, "qualificationDetail"),
            ["address"] = JoinWithDash(
                StringFrom(mother, "residenceDetail"),
                StringFrom(mother, "residenceDistrict"),
                StringFrom(mother, "residenceGovernorate")),
            ["nationalId"] = StringFrom(mother, "nationalId"),
            ["deceased"] = BoolFrom(mother, "deceased"),
        };
        if (firstHusband is not null)
        {
            record["hasCurrentHusband"] = true;
            record["currentHusbandCount"] = "1";
            record["currentHusband"] = MapSpouseSubRecord(firstHusband);
        }
        return record;
    }

    private static JsonObject MapGrandparentRecord(JsonObject src) => new()
    {
        ["fullName"] = FamilyMemberName(src),
        ["shuhraName"] = StringFrom(src, "shuhra"),
        ["dateOfBirth"] = StringFrom(src, "dateOfBirth"),
        ["birthPlace"] = StringFrom(src, "birthDistrict"),
        ["governorate"] = StringFrom(src, "birthGovernorate"),
        ["religion"] = StringFrom(src, "religion"),
        ["alive"] = BoolFrom(src, "deceased") ? "deceased" : "alive",
        ["nationalId"] = StringFrom(src, "nationalId"),
        ["nidUnavailable"] = BoolFrom(src, "nidUnavailable"),
        ["nidUnavailableReason"] = StringFrom(src, "nidUnavailableReason"),
        ["qualification"] = StringFrom(src, "qualification"),
        ["profession"] = StringFrom(src, "profession"),
        ["seniorityNumber"] = StringFrom(src, "seniorityNumber"),
        ["workplace"] = StringFrom(src, "professionDetail"),
        ["workNature"] = StringFrom(src, "qualificationDetail"),
        ["address"] = JoinWithDash(
            StringFrom(src, "residenceDetail"),
            StringFrom(src, "residenceDistrict"),
            StringFrom(src, "residenceGovernorate")),
    };

    /// <summary>Guardian (نموذج 3) — only emitted when a name was entered,
    /// mirroring the frontend's `savedGuardian` gate.</summary>
    private static JsonObject? MapGuardianRecord(JsonObject? guardian)
    {
        if (guardian is null) return null;
        var name = FamilyMemberName(guardian);
        if (string.IsNullOrWhiteSpace(name)) return null;
        return new JsonObject
        {
            ["fullName"] = name,
            ["qualification"] = StringFrom(guardian, "qualification"),
            ["profession"] = StringFrom(guardian, "profession"),
            ["workNature"] = StringFrom(guardian, "workplaceDetail"),
        };
    }

    private static JsonObject MapSpouseSubRecord(JsonObject member) => new()
    {
        ["fullName"] = FamilyMemberName(member),
        ["dateOfBirth"] = StringFrom(member, "dateOfBirth"),
        ["nationalId"] = StringFrom(member, "nationalId"),
        ["qualification"] = StringFrom(member, "qualification"),
        ["birthPlace"] = JoinWithDash(StringFrom(member, "birthDistrict"), StringFrom(member, "birthGovernorate")),
        ["profession"] = StringFrom(member, "profession"),
        ["seniorityNumber"] = StringFrom(member, "seniorityNumber"),
        ["workplace"] = StringFrom(member, "professionDetail"),
        ["workNature"] = StringFrom(member, "qualificationDetail"),
    };

    /// <summary>Join the three Arabic name parts (first/father/grandfather)
    /// into the canonical display form, dropping empties. Mirrors
    /// formatMemberName in familyData.ts (without the "—" placeholder —
    /// blank stays blank so the document field shows empty, not a dash).</summary>
    private static string FamilyMemberName(JsonObject? member)
    {
        if (member is null) return "";
        var parts = new[]
        {
            StringFrom(member, "firstName"),
            StringFrom(member, "secondName"),
            StringFrom(member, "thirdName"),
        }
            .Select(p => p.Trim())
            .Where(p => p.Length > 0);
        return string.Join(" ", parts);
    }

    /// <summary>Join non-blank values with " — " preserving order.</summary>
    private static string JoinWithDash(params string[] values) =>
        string.Join(" — ", values.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()));

    private static bool BoolFrom(JsonObject? obj, string key)
    {
        if (obj is null || obj[key] is null) return false;
        try { return obj[key]!.GetValue<bool>(); }
        catch { return false; }
    }

    private static string CommitteeNameFromDraft(JsonObject draft) =>
        FirstPresentString(draft, "assignedCommitteeName", "committeeName", "committeeLabelAr");

    private static string FirstPresentString(JsonObject obj, params string[] keys)
    {
        foreach (var key in keys)
        {
            var text = StringFrom(obj, key);
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }
        return "";
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

    /// <summary>
    /// Whether the configured opening TIMING has arrived for schedule-based modes
    /// (<c>before_test</c> / <c>on_test_time</c>). The <c>after_test_passed</c> mode
    /// opens via the outcome check in the caller, not here.
    /// </summary>
    private static bool IsScheduleOpen(JsonObject draft, ResolvedAcquaintanceSettings settings)
    {
        if (settings.OpeningMode == "after_test_passed") return false;

        var examDate = DateForConfiguredTestFromDraft(draft, settings.OpeningTestKey);
        if (examDate is null) return false;

        var openAt = settings.OpeningMode switch
        {
            "before_test" => examDate.Value - settings.OpeningOffset,
            "on_test_time" => examDate.Value,
            _ => (DateTimeOffset?)null,
        };
        return openAt is not null && DateTimeOffset.UtcNow >= openAt;
    }

    private static bool IsCloseDue(JsonObject draft, ResolvedAcquaintanceSettings settings)
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
            "before_test" => examDate.Value - settings.ClosingOffset,
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

    /// <summary>First non-blank value, or "" when all are blank.</summary>
    private static string FirstNonEmpty(params string[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }
        return "";
    }

    /// <summary>Extract a 4-digit calendar year from a date / year string
    /// (e.g. "2024-06-30" → "2024"); "" when none is present.</summary>
    private static string YearFromValue(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var match = System.Text.RegularExpressions.Regex.Match(value, "(19|20)\\d{2}");
        return match.Success ? match.Value : "";
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

public sealed record PickedCommittee(string? CommitteeId, string? CommitteeName);
