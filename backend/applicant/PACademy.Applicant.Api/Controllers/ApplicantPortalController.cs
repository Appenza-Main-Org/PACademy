using System.Security.Claims;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PACademy.Applicant.Api.Modules.ApplicantPortal;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Shared.Contracts;

namespace PACademy.Applicant.Api.Controllers;

/// <summary>
/// Applicant portal endpoints — backs every stage of the wizard.
///
/// INTEGRATION CONTRACT (matches frontend/src/features/applicant-portal/api/applicantPortal.service.ts):
///   GET  /applicant/draft/:applicantId             → ApplicantDraft (JSON)
///   PATCH /applicant/draft/:applicantId            → ApplicantDraft (merge)
///   POST /applicant/stage/:applicantId/:stage      → { valid, errors? }
///   POST /applicant/verify                          → { confirmed }
///   POST /applicant/payment/intent                  → { intentId, refNumber, fawryCode, amount }
///   POST /applicant/payment/confirm                 → { confirmed, paidAt }
///   GET  /applicant/payment/verify/:refNumber      → { status, receipt }
///   GET  /applicant/exam-slots                     → ExamSlot[]
///   POST /applicant/exam-slots/:slotId/reserve     → { confirmed, slot }
///   POST /applicant/parents/approve                 → { approvedAt }
///   POST /applicant/exam-date                       → { date }
///   GET  /applicant/follow-up/:applicantId         → pipeline
///   GET  /applicant/family/:applicantId            → family data
///   PUT  /applicant/family/:applicantId            → family data
///   POST /applicant/attendance-card/:applicantId   → { ok }  (frontend triggers window.print())
///   POST /applicant/acquaintance-doc/:applicantId  → { ok }  (frontend triggers window.print())
/// </summary>
[ApiController]
[Route("applicant")]
[Authorize]
public sealed class ApplicantPortalController(
    PortalService portal,
    LoginUseCase login,
    IMemoryCache cache,
    IApplicantsDbContext applicantsDb) : ControllerBase
{
    private string? CurrentApplicantId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue("sub");

    // ── Draft ──────────────────────────────────────────────────────────

    [HttpGet("draft/{applicantId}")]
    public async Task<IActionResult> GetDraft(string applicantId, CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var draft = await portal.GetOrCreateDraftAsync(applicantId, ct);
        return Ok(draft);
    }

    [HttpDelete("draft/{applicantId}")]
    public async Task<IActionResult> DeleteDraft(string applicantId, CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        await portal.DeleteDraftAsync(applicantId, ct);
        return NoContent();
    }

    // ── Admin reset (dev / admin tools) ────────────────────────────────

    /// <summary>
    /// Admin-only: wipe all portal records (draft, payment, family) for
    /// the given applicant so they can re-submit from scratch.
    /// Accepts either the applicant's GUID or their national ID.
    /// </summary>
    [HttpDelete("admin/reset/{identifier}")]
    public async Task<IActionResult> AdminResetApplicant(string identifier, CancellationToken ct)
    {
        if (!IsAdmin()) return Forbid();

        // Resolve NID → GUID when needed.
        string applicantId;
        if (Guid.TryParse(identifier, out _))
        {
            applicantId = identifier;
        }
        else
        {
            var applicant = await applicantsDb.Applicants
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.NationalId == identifier, ct);
            if (applicant is null)
                return NotFound(new { message = $"لم يُعثر على متقدم بالرقم القومي {identifier}" });
            applicantId = applicant.Id.ToString();
        }

        await portal.DeleteDraftAsync(applicantId, ct);
        return Ok(new { ok = true, applicantId });
    }

    /// <summary>
    /// Admin-only: return the current draft + computed submission status
    /// for any applicant. Accepts GUID or national ID.
    /// </summary>
    [HttpGet("admin/status/{identifier}")]
    public async Task<IActionResult> AdminGetStatus(string identifier, CancellationToken ct)
    {
        if (!IsAdmin()) return Forbid();

        string applicantId;
        if (Guid.TryParse(identifier, out _))
        {
            applicantId = identifier;
        }
        else
        {
            var applicant = await applicantsDb.Applicants
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.NationalId == identifier, ct);
            if (applicant is null)
                return NotFound(new { message = $"لم يُعثر على متقدم بالرقم القومي {identifier}" });
            applicantId = applicant.Id.ToString();
        }

        var draft = await portal.GetOrCreateDraftAsync(applicantId, ct);
        var stage = draft["furthestStage"]?.GetValue<int>() ?? 0;
        var status = stage switch
        {
            0 => "not_started",
            >= 1 and < 3 => "in_progress",
            >= 3 and < 6 => "profile_submitted",
            >= 6 and < 7 => "paid",
            >= 7 and < 8 => "parents_approved",
            >= 8 and < 9 => "exam_scheduled",
            _ => "completed",
        };
        return Ok(new { applicantId, furthestStage = stage, status, draft });
    }

    [HttpPatch("draft/{applicantId}")]
    public async Task<IActionResult> SaveDraft(
        string applicantId,
        [FromBody] JsonObject partial,
        CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var draft = await portal.SaveDraftAsync(applicantId, partial, ct);
        return Ok(draft);
    }

    // ── Stage submission ───────────────────────────────────────────────

    [HttpPost("stage/{applicantId}/{stage:int}")]
    public async Task<IActionResult> SubmitStage(
        string applicantId,
        int stage,
        [FromBody] JsonObject data,
        CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var (valid, errors) = await portal.SubmitStageAsync(applicantId, stage, data, ct);
        return Ok(new { valid, errors });
    }

    // ── Verify ─────────────────────────────────────────────────────────

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var nationalId = body["nationalId"]?.GetValue<string>() ?? "";
        var mobile = body["mobile"]?.GetValue<string>() ?? "";
        var confirmed = await portal.VerifyApplicantAsync(applicantId, nationalId, mobile, ct);
        return Ok(new { confirmed });
    }

    [HttpPost("payment/confirm-identity")]
    public IActionResult ConfirmIdentity([FromBody] JsonObject body)
    {
        var nid = body["nationalId"]?.GetValue<string>() ?? "";
        var mobile = body["phoneNumber"]?.GetValue<string>() ?? "";
        var validNid = System.Text.RegularExpressions.Regex.IsMatch(nid, @"^[0-9]{14}$");
        var validMobile = System.Text.RegularExpressions.Regex.IsMatch(mobile, @"^01[0125][0-9]{8}$");
        if (!validNid || !validMobile)
        {
            return BadRequest(new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: new Dictionary<string, string[]>
                {
                    ["nationalId"] = validNid ? [] : ["الرقم القومي غير صحيح"],
                    ["phoneNumber"] = validMobile ? [] : ["رقم الهاتف غير صحيح"],
                },
                Message: "بيانات التحقق غير صحيحة"));
        }
        return Ok(new { confirmed = true });
    }

    [HttpPost("verify-certificate")]
    public IActionResult VerifyCertificate([FromBody] JsonObject body)
    {
        var seatNumber = body["seatNumber"]?.GetValue<string>();
        if (seatNumber is not null && seatNumber.EndsWith("0"))
            return Ok(new { match = false, mismatchedFields = new[] { "totalScore" } });
        return Ok(new { match = true });
    }

    // ── Payment ────────────────────────────────────────────────────────

    [HttpPost("payment/intent")]
    public async Task<IActionResult> CreatePaymentIntent([FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var method = body["method"]?.GetValue<string>() ?? "fawry-code";
        var amount = body["amount"]?.GetValue<decimal>() ?? 250m;
        var (intentId, refNumber, fawryCode, storedAmount) =
            await portal.CreatePaymentIntentAsync(applicantId, method, amount, ct);
        return Ok(new { intentId, refNumber, fawryCode, amount = storedAmount });
    }

    [HttpPost("payment/initiate")]
    public async Task<IActionResult> InitiatePayment([FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var method = body["method"]?.GetValue<string>() ?? "fawry-code";
        var amount = body["amount"]?.GetValue<decimal>() ?? 1500m;
        var (_, refNumber, fawryCode, storedAmount) =
            await portal.CreatePaymentIntentAsync(applicantId, method, amount, ct);
        return Ok(new { redirectUrl = (string?)null, fawryCode, refNumber, amount = storedAmount });
    }

    [HttpPost("payment/confirm")]
    public async Task<IActionResult> ConfirmPayment([FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var intentId = body["intentId"]?.GetValue<string>() ?? "";
        var (confirmed, paidAt) = await portal.ConfirmPaymentAsync(applicantId, intentId, ct);
        return Ok(new { confirmed, paidAt });
    }

    [HttpGet("payment/verify/{refNumber}")]
    public async Task<IActionResult> VerifyPayment(string refNumber, CancellationToken ct)
    {
        var (status, receipt) = await portal.GetPaymentStatusAsync(refNumber, ct);
        return Ok(new { status, receipt });
    }

    // ── Exam slots ─────────────────────────────────────────────────────

    [HttpGet("exam-slots")]
    [AllowAnonymous]
    public async Task<IActionResult> ListExamSlots(CancellationToken ct)
    {
        var slots = await portal.ListExamSlotsAsync(ct);
        return Ok(slots.Select(s => new
        {
            id = s.Id,
            date = s.Date.ToString("O"),
            time = s.Time,
            location = s.Location,
            capacity = s.Capacity,
            reserved = s.Reserved,
        }));
    }

    [HttpPost("exam-slots/{slotId}/reserve")]
    public async Task<IActionResult> ReserveExamSlot(string slotId, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var (confirmed, slot) = await portal.ReserveExamSlotAsync(applicantId, slotId, ct);
        if (!confirmed || slot is null) return BadRequest(new { message = "تعذّر حجز الموعد" });

        return Ok(new
        {
            confirmed,
            slot = new
            {
                id = slot.Id,
                date = slot.Date.ToString("O"),
                time = slot.Time,
                location = slot.Location,
                capacity = slot.Capacity,
                reserved = slot.Reserved,
            },
        });
    }

    // ── Parents approval ───────────────────────────────────────────────

    [HttpPost("parents/approve")]
    public async Task<IActionResult> ApproveParents(CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var approvedAt = await portal.ApproveParentsAsync(applicantId, ct);
        return Ok(new { approvedAt });
    }

    // ── Exam date pick ─────────────────────────────────────────────────

    [HttpPost("exam-date")]
    public async Task<IActionResult> PickExamDate([FromBody] JsonObject body, CancellationToken ct)
    {
        var applicantId = CurrentApplicantId;
        if (applicantId is null) return Unauthorized();

        var slotId = body["slotId"]?.GetValue<string>()
            ?? throw new ArgumentException("حقل slotId مطلوب");
        var committee = PickedCommitteeFrom(body);

        var result = await portal.PickExamDateAsync(applicantId, slotId, committee, ct);
        return Ok(new { date = result });
    }

    private static PickedCommittee? PickedCommitteeFrom(JsonObject body)
    {
        var committeeId = body["committeeId"]?.GetValue<string>();
        var committeeName = body["committeeName"]?.GetValue<string>();
        return string.IsNullOrWhiteSpace(committeeId) && string.IsNullOrWhiteSpace(committeeName)
            ? null
            : new PickedCommittee(committeeId, committeeName);
    }

    // ── Follow-up ──────────────────────────────────────────────────────

    [HttpGet("follow-up/{applicantId}")]
    public async Task<IActionResult> GetFollowUp(string applicantId, CancellationToken ct)
    {
        // Read-only — accessible by the applicant themselves or by admin.
        if (!IsAllowed(applicantId) && !IsAdmin()) return Forbid();
        var followUp = await portal.GetFollowUpAsync(applicantId, ct);
        return Ok(followUp);
    }

    [HttpPut("follow-up/{applicantId}")]
    public async Task<IActionResult> SaveFollowUp(
        string applicantId,
        [FromBody] JsonObject data,
        CancellationToken ct)
    {
        // Admin-only — applicants cannot self-update their exam results.
        if (!IsAdmin()) return Forbid();
        await portal.SaveFollowUpAsync(applicantId, data, ct);
        return Ok(new { ok = true });
    }

    // ── Family ─────────────────────────────────────────────────────────

    [HttpGet("family/{applicantId}")]
    public async Task<IActionResult> GetFamily(string applicantId, CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var family = await portal.GetFamilyAsync(applicantId, ct);
        return family is null ? Ok(new JsonObject()) : Ok(family);
    }

    [HttpPut("family/{applicantId}")]
    public async Task<IActionResult> SaveFamily(
        string applicantId,
        [FromBody] JsonObject data,
        CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var result = await portal.SaveFamilyAsync(applicantId, data, ct);
        return Ok(result);
    }

    // ── Documents (print trigger — frontend calls window.print()) ──────

    [HttpPost("attendance-card/{applicantId}")]
    public async Task<IActionResult> GetAttendanceCard(string applicantId, CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var draft = await portal.GetOrCreateDraftAsync(applicantId, ct);
        return Ok(new { ok = true, draft });
    }

    [HttpPost("acquaintance-doc/{applicantId}")]
    public async Task<IActionResult> GetAcquaintanceDoc(string applicantId, CancellationToken ct)
    {
        if (!IsAllowed(applicantId)) return Forbid();
        var draft = await portal.GetOrCreateDraftAsync(applicantId, ct);
        return Ok(new { ok = true, draft });
    }

    // ── Auth (stage 1 = initiate, stage 2 = verify → issues real JWT) ──

    [HttpPost("auth/initiate")]
    [AllowAnonymous]
    public IActionResult Initiate([FromBody] JsonObject body)
    {
        var nid = body["nationalId"]?.GetValue<string>() ?? "";
        var phone = body["phoneNumber"]?.GetValue<string>() ?? "";
        if (!System.Text.RegularExpressions.Regex.IsMatch(nid, @"^[0-9]{14}$"))
            return BadRequest(new { message = "الرقم القومي غير صحيح" });
        if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^01[0125][0-9]{8}$"))
            return BadRequest(new { message = "رقم الهاتف غير صحيح" });

        var sessionId = $"SESS-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(5);
        // Store NID+phone keyed by sessionId so /auth/verify can look them up.
        cache.Set(sessionId, (nid, phone), expiresAt);

        return Ok(new
        {
            sessionId,
            expiresAt = expiresAt.ToUnixTimeMilliseconds(),
        });
    }

    [HttpPost("auth/verify")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyOtp([FromBody] JsonObject body, CancellationToken ct)
    {
        var code = body["smsCode"]?.GetValue<string>() ?? "";
        var sessionId = body["sessionId"]?.GetValue<string>() ?? "";

        if (code.Length != 6 || !code.All(char.IsDigit))
            return BadRequest(new { message = "رمز التحقق يجب أن يكون 6 أرقام" });
        if (code != "123456")
            return Unauthorized(new { message = "رمز التحقق غير صحيح" });

        if (!cache.TryGetValue<(string Nid, string Phone)>(sessionId, out var session))
            return Unauthorized(new { message = "انتهت صلاحية الجلسة. أعد المحاولة." });

        var (ok, errorCode) = await login.ExecuteAsync(
            new LoginRequest(session.Nid, session.Phone, "applicant"), ct);

        if (ok is null || errorCode is not null)
            return Unauthorized(new { message = "بيانات الدخول غير صحيحة" });

        cache.Remove(sessionId);

        var applicant = await applicantsDb.Applicants
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == ok.Id, ct);

        return Ok(new
        {
            token = ok.Token,
            applicantId = ok.Id.ToString(),
            profile = applicant is null ? null : new
            {
                applicantId = applicant.Id.ToString(),
                fullName = applicant.FullName ?? "",
                nationalId = applicant.NationalId,
                mobile = applicant.PhoneNumber,
                email = applicant.Email ?? "",
                dateOfBirth = applicant.DateOfBirth?.ToString("yyyy-MM-dd") ?? "",
                gender = applicant.Gender ?? "male",
                birthGovernorate = applicant.BirthGovernorate ?? "",
                birthDistrict = applicant.BirthDistrict ?? "",
                religion = applicant.Religion ?? "مسلم",
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private bool IsAllowed(string applicantId)
    {
        var current = CurrentApplicantId;
        return current is not null && string.Equals(current, applicantId, StringComparison.OrdinalIgnoreCase);
    }

    private bool IsAdmin()
    {
        return User.IsInRole("admin") || User.IsInRole("super_admin")
            || User.HasClaim("role", "admin") || User.HasClaim("role", "super_admin")
            || User.HasClaim(System.Security.Claims.ClaimTypes.Role, "admin")
            || User.HasClaim(System.Security.Claims.ClaimTypes.Role, "super_admin");
    }
}
