using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Admin.Api.Infrastructure;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Biometric;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Biometric Registration &amp; Inquiry REST surface (BRD §5). Mirrors the
/// INTEGRATION CONTRACT in
/// <c>frontend/src/features/biometric/api/biometric.service.ts</c>.
/// </summary>
[ApiController]
[Route("")]
public sealed class BiometricController(BiometricService service, IServiceProvider sp) : ControllerBase
{
    /* ── ZKBioTime directory (live device + personnel listing) ─────────── */

    [HttpGet("api/biometric/zk/devices")]
    public async Task<ActionResult<object>> ZkDevices(CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        try
        {
            var rows = await client.ListTerminalsAsync(ct);
            // Resolve the live server URL (admin-screen override first, then appsettings).
            var webUrl = await client.GetBaseUrlOrNullAsync(ct);
            return Ok(new { mode = "zkbiotime", count = rows.Count, data = rows, webUrl });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    [HttpGet("api/biometric/zk/employees")]
    public async Task<ActionResult<object>> ZkEmployees(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 100, CancellationToken ct = default)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        try
        {
            var (rows, count) = await client.ListEmployeesAsync(page, pageSize, ct);
            return Ok(new { mode = "zkbiotime", count, data = rows });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Identify whoever last presented a biometric at the terminal (1:N): returns
    /// the most recent punch within the window and resolves its emp_code to an
    /// applicant (emp_code is the national id) when one exists.
    /// </summary>
    [HttpGet("api/biometric/zk/last-punch")]
    public async Task<ActionResult<object>> ZkLastPunch(
        [FromQuery] int windowSeconds = 120, CancellationToken ct = default)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        try
        {
            var punch = await client.GetLatestTransactionAsync(windowSeconds, null, ct);
            if (punch is null) return Ok(new { found = false });
            var applicant = await service.GetApplicantAsync(null, punch.EmpCode, null, ct);
            return Ok(new
            {
                found = true,
                empCode = punch.EmpCode,
                deviceName = punch.Name,
                verifyType = punch.VerifyType,
                verifyTypeDisplay = punch.VerifyTypeDisplay,
                uploadTime = punch.UploadTime,
                punchTime = punch.PunchTime,
                terminalSn = punch.TerminalSn,
                terminalAlias = punch.TerminalAlias,
                areaName = punch.AreaName,
                deviceEmpId = punch.Emp,
                applicant,
            });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Realtime feed: the most recent device punches within the window, each
    /// resolved to an applicant (emp_code = national id) when one exists.
    /// Polled by the live "identify from device" screen.
    /// </summary>
    [HttpGet("api/biometric/zk/recent-punches")]
    public async Task<ActionResult<object>> ZkRecentPunches(
        [FromQuery] int windowSeconds = 300, [FromQuery] int limit = 20,
        [FromQuery] string? since = null, CancellationToken ct = default)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        try
        {
            // `since` = newest upload_time the client already has → only new punches come back.
            var punches = await client.GetRecentPunchesAsync(windowSeconds, limit, since, ct);
            var map = await service.ResolvePunchesAsync(punches.Select(p => (p.Emp, p.EmpCode)), ct);
            var data = punches.Select(p =>
            {
                map.TryGetValue(p.EmpCode, out var applicant);
                return new
                {
                    id = p.Id,
                    empCode = p.EmpCode,
                    deviceName = p.Name,
                    verifyType = p.VerifyType,
                    verifyTypeDisplay = p.VerifyTypeDisplay,
                    uploadTime = p.UploadTime,
                    punchTime = p.PunchTime,
                    terminalSn = p.TerminalSn,
                    terminalAlias = p.TerminalAlias,
                    areaName = p.AreaName,
                    deviceEmpId = p.Emp,
                    applicantId = applicant is null ? null : AdminRecordJson.StringProp(applicant, "id"),
                    applicantName = applicant is null ? null : AdminRecordJson.StringProp(applicant, "name"),
                };
            });
            // Advance the cursor to the newest upload_time we saw (or echo the incoming
            // one when nothing new), so the next poll asks only for later punches.
            var cursor = punches
                .Select(p => p.UploadTime)
                .Where(u => !string.IsNullOrEmpty(u))
                .DefaultIfEmpty(since)
                .Max();
            return Ok(new { count = punches.Count, data, cursor });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Listen-and-verify (1:N): take the latest device punch within the window,
    /// resolve it to an applicant by the device-assigned employee id, and run the
    /// full verification — no identifier typed by the operator.
    /// </summary>
    [HttpPost("api/biometric/verify-live")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> VerifyLive([FromBody] JsonObject input, CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        // Default 0 = no absolute-time gate: return the newest punch and let the
        // live-listen UI's baseline cursor decide freshness. This makes verify-live
        // independent of the ZK server clock offset (a misconfigured
        // ServerTimeUtcOffsetHours used to silently drop every punch). An explicit
        // windowSeconds is still honoured if a caller sends one.
        var windowSeconds = AdminRecordJson.NumberProp(input, "windowSeconds") is { } w ? (int)w : 0;
        var module = AdminRecordJson.StringProp(input, "module") ?? "security-gate";
        var terminalSn = AdminRecordJson.StringProp(input, "terminalSn");
        try
        {
            var punch = await client.GetLatestTransactionAsync(windowSeconds, terminalSn, ct);
            if (punch is null)
                return Ok(new JsonObject
                {
                    ["status"] = "no_match",
                    ["ok"] = false,
                    ["found"] = false,
                    ["reason"] = "لا توجد بصمة حديثة على الجهاز — اطلب من المتقدم وضع البصمة ثم أعد المحاولة",
                    ["canContinue"] = false,
                });

            var applicantId = await service.ResolvePunchApplicantIdAsync(punch.Emp, punch.EmpCode, ct);
            if (string.IsNullOrEmpty(applicantId))
                return Ok(new JsonObject
                {
                    ["status"] = "no_match",
                    ["ok"] = false,
                    ["found"] = true,
                    ["identifiedName"] = punch.Name,
                    ["identifiedEmpCode"] = punch.EmpCode,
                    ["identifiedDeviceEmpId"] = punch.Emp,
                    ["identifiedAreaName"] = punch.AreaName,
                    ["identifiedTerminalSn"] = punch.TerminalSn,
                    ["identifiedTerminalAlias"] = punch.TerminalAlias,
                    ["identifiedUploadTime"] = punch.UploadTime,
                    ["identifiedVerifyType"] = punch.VerifyType,
                    ["reason"] = "البصمة غير مرتبطة بمتقدم مسجّل",
                    ["canContinue"] = false,
                });

            // Honour the requested method, else infer modality from the punch (15=face, 1=fingerprint).
            var method = AdminRecordJson.StringProp(input, "method")
                ?? (punch.VerifyType == 15 ? "face" : "fingerprint");

            var verifyInput = new JsonObject
            {
                ["applicantId"] = applicantId,
                ["method"] = method,
                ["module"] = module,
                ["today"] = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd"),
                // The terminal already performed the 1:N biometric match (this punch
                // IS the proof) — don't re-poll by national id.
                ["biometricMatched"] = true,
            };
            var result = await service.VerifyAsync(verifyInput, ct);
            result["found"] = true;
            result["identifiedName"] = punch.Name;
            result["identifiedEmpCode"] = punch.EmpCode;
            result["identifiedDeviceEmpId"] = punch.Emp;
            result["identifiedAreaName"] = punch.AreaName;
            result["identifiedTerminalSn"] = punch.TerminalSn;
            result["identifiedTerminalAlias"] = punch.TerminalAlias;
            result["identifiedUploadTime"] = punch.UploadTime;
            result["identifiedVerifyType"] = punch.VerifyType;
            return Ok(result);
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Bind an existing ZK device employee to a PACademy applicant (e.g. when the
    /// biometric was enrolled on the terminal under a different employee record),
    /// so that device's punches resolve to the applicant.
    /// </summary>
    [HttpPost("api/biometric/zk/bind")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> ZkBind([FromBody] JsonObject input, CancellationToken ct)
    {
        var deviceEmpCode = AdminRecordJson.StringProp(input, "deviceEmpCode") ?? "";
        var deviceEmpId = AdminRecordJson.NumberProp(input, "deviceEmpId") is { } n ? (int)n : 0;
        try
        {
            var record = await service.BindDeviceEmployeeAsync(
                AdminRecordJson.StringProp(input, "applicantId"),
                AdminRecordJson.StringProp(input, "nationalId"),
                deviceEmpCode, deviceEmpId, ct);
            return Ok(record);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new ApiErrorEnvelope("NOT_FOUND", Message: ex.Message));
        }
    }

    /* ── ZKBioTime area transfer (bulk move applicants between areas) ──── */

    /// <summary>Registered ZKBioTime areas (device zones) — the move target picker.</summary>
    [HttpGet("api/biometric/zk/areas")]
    public async Task<ActionResult<object>> ZkAreas(CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        try
        {
            var rows = await client.ListAreasAsync(ct);
            return Ok(new { mode = "zkbiotime", count = rows.Count, data = rows });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Candidate applicants for a bulk area move, filtered by committee and/or
    /// current exam result. PACademy-sourced (works without ZKBioTime); each row
    /// carries the stored device employee id + a <c>linked</c> flag.
    /// </summary>
    [HttpGet("api/biometric/applicants/for-area-move")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> AreaMoveCandidates(
        [FromQuery] string? committee, [FromQuery] string? examResult, CancellationToken ct)
        => Ok(await service.ListApplicantsForAreaMoveAsync(committee, examResult, ct));

    /// <summary>
    /// Bulk-move the selected applicants to a ZKBioTime area. Resolves each
    /// applicant's device employee id — stored id first, else a live
    /// <c>emp_code</c> (= national id) lookup — then calls the platform's
    /// <c>adjust_area</c>. Applicants with no ZKBioTime employee are reported as
    /// skipped (enroll them first).
    /// </summary>
    [HttpPost("api/biometric/zk/adjust-area")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> ZkAdjustArea([FromBody] JsonObject input, CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();

        var areaId = AdminRecordJson.NumberProp(input, "areaId") is { } a ? (int)a : 0;
        if (areaId <= 0)
            return BadRequest(new ApiErrorEnvelope("VALIDATION", Message: "لم يتم اختيار المنطقة المستهدفة"));

        var applicantIds = (input["applicantIds"] as JsonArray)?
            .Select(n => n?.ToString())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!)
            .ToList() ?? [];
        if (applicantIds.Count == 0)
            return BadRequest(new ApiErrorEnvelope("VALIDATION", Message: "لم يتم تحديد أي متقدم"));

        try
        {
            var selectedIds = applicantIds.Distinct().ToList();
            var targets = (await service.GetAreaMoveTargetsAsync(selectedIds, ct))
                .GroupBy(t => AdminRecordJson.StringProp(t, "applicantId") ?? "")
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

            // Iterate the SELECTION (not just resolved targets) so every applicant is
            // accounted for — moved or skipped, never silently dropped.
            var employeeIds = new List<int>();
            var movedApplicantIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var applicantId in selectedIds)
            {
                targets.TryGetValue(applicantId, out var target);
                var stored = target is null ? null : AdminRecordJson.StringProp(target, "deviceEmpId");
                var nationalId = target is null ? null : AdminRecordJson.StringProp(target, "nationalId");

                var employeeId = int.TryParse(stored, out var storedId) && storedId > 0 ? storedId : 0;
                // Fallback: resolve the device employee live by emp_code (= national id).
                if (employeeId == 0 && !string.IsNullOrWhiteSpace(nationalId)
                    && await client.FindEmployeeAsync(nationalId, ct) is { } emp
                    && int.TryParse(emp["id"]?.ToString(), out var liveId) && liveId > 0)
                {
                    employeeId = liveId;
                }

                if (employeeId > 0)
                {
                    employeeIds.Add(employeeId);
                    movedApplicantIds.Add(applicantId);
                }
            }
            var skipped = selectedIds.Where(id => !movedApplicantIds.Contains(id)).ToList();

            if (employeeIds.Count == 0)
                return Ok(new { ok = false, moved = 0, skipped, message = "لا يوجد متقدمون مسجّلون على المنظومة ضمن التحديد — سجّل البصمة أولاً" });

            await client.AdjustAreaAsync(employeeIds, [areaId], ct);
            return Ok(new { ok = true, moved = employeeIds.Count, skipped });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Register the applicant's existing device employee on an additional
    /// terminal: appends the terminal's area to the employee's area list (the
    /// platform syncs the record to every terminal in its areas). Keeps the
    /// areas already assigned — "also on this device", not a move.
    /// </summary>
    [HttpPost("api/biometric/zk/add-device")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> ZkAddDevice([FromBody] JsonObject input, CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();

        var nationalId = AdminRecordJson.StringProp(input, "nationalId");
        var terminalSn = AdminRecordJson.StringProp(input, "terminalSn");
        if (string.IsNullOrWhiteSpace(nationalId) || string.IsNullOrWhiteSpace(terminalSn))
            return BadRequest(new ApiErrorEnvelope("VALIDATION", Message: "الرقم القومي والجهاز مطلوبان"));

        try
        {
            if (await client.FindEmployeeAsync(nationalId, ct) is not { } employee
                || !int.TryParse(employee["id"]?.ToString(), out var employeeId) || employeeId <= 0)
                return NotFound(new ApiErrorEnvelope(
                    "NOT_FOUND", Message: "المتقدم غير مسجل على المنظومة — أنشئ السجل على جهاز أولاً"));

            var areaId = await client.GetTerminalAreaIdAsync(terminalSn, ct);
            if (areaId is null)
                return BadRequest(new ApiErrorEnvelope("VALIDATION", Message: "الجهاز المحدد غير معروف على المنظومة"));

            var currentAreaIds = ZkBioTimeClient.ReadEmployeeAreaIds(employee);
            if (currentAreaIds.Contains(areaId.Value))
                return Conflict(new ApiErrorEnvelope(
                    "CONFLICT", ConflictCode: "BIOMETRIC_ALREADY_ON_DEVICE",
                    Message: "المتقدم مسجل على هذا الجهاز بالفعل"));

            await client.AdjustAreaAsync([employeeId], [.. currentAreaIds, areaId.Value], ct);
            return Ok(new { ok = true, areaId = areaId.Value });
        }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /* ── ZKBioTime connection config (set from the admin screen) ───────── */

    [HttpGet("api/biometric/zk/config")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> GetZkConfig(CancellationToken ct)
    {
        var records = sp.GetService<OperationalRecordsService>();
        var rec = records is null ? null : await records.GetAsync(ZkBioTimeClient.ConfigBucket, ZkBioTimeClient.ConfigId, ct);
        var cfg = sp.GetService<IConfiguration>();
        string? Db(string k) => rec is not null && AdminRecordJson.StringProp(rec, k) is { } v && !string.IsNullOrWhiteSpace(v) ? v : null;
        string? Cfg(string k) => cfg?[$"Biometric:ZkBioTime:{k}"] is { } v && !string.IsNullOrWhiteSpace(v) ? v : null;
        string? V(string k) => Db(k) ?? Cfg(k);
        return Ok(new
        {
            baseUrl = V("BaseUrl"),
            username = V("Username"),
            passwordSet = !string.IsNullOrWhiteSpace(V("Password")),
            authPath = V("AuthPath") ?? "/jwt-api-token-auth/",
            tokenScheme = V("TokenScheme") ?? "JWT",
            serverTimeUtcOffsetHours = V("ServerTimeUtcOffsetHours") ?? "0",
            source = rec is null ? "appsettings" : "database",
        });
    }

    [HttpPut("api/biometric/zk/config")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> SaveZkConfig([FromBody] JsonObject input, CancellationToken ct)
    {
        var records = sp.GetService<OperationalRecordsService>();
        if (records is null) return ZkInactive();
        var rec = await records.GetAsync(ZkBioTimeClient.ConfigBucket, ZkBioTimeClient.ConfigId, ct) ?? new JsonObject();

        void Set(string key)
        {
            if (input.TryGetPropertyValue(key, out var n) && n is not null && !string.IsNullOrWhiteSpace(n.ToString()))
                rec[key] = n.ToString();
        }
        Set("BaseUrl"); Set("Username"); Set("AuthPath"); Set("TokenScheme"); Set("ServerTimeUtcOffsetHours");
        // Password updated only when a non-empty value is supplied (so it isn't wiped on save).
        if (input.TryGetPropertyValue("Password", out var pw) && pw is not null && !string.IsNullOrWhiteSpace(pw.ToString()))
            rec["Password"] = pw.ToString();
        rec["id"] = ZkBioTimeClient.ConfigId;

        await records.UpsertAsync(ZkBioTimeClient.ConfigBucket, ZkBioTimeClient.ConfigId, rec, ct);
        sp.GetService<IMemoryCache>()?.Remove(ZkBioTimeClient.TokenCacheKey); // force re-auth with the new server/creds
        return Ok(new { ok = true });
    }

    [HttpPost("api/biometric/zk/test-connection")]
    [RequireBearerAuth]
    public async Task<ActionResult<object>> TestZkConnection(CancellationToken ct)
    {
        var client = sp.GetService<ZkBioTimeClient>();
        if (client is null || !await client.IsConfiguredAsync(ct)) return ZkInactive();
        sp.GetService<IMemoryCache>()?.Remove(ZkBioTimeClient.TokenCacheKey);
        try
        {
            await client.GetTokenAsync(force: true, ct);
            var terminals = await client.ListTerminalsAsync(ct);
            return Ok(new { ok = true, deviceCount = terminals.Count, message = $"تم الاتصال بنجاح · {terminals.Count} جهاز" });
        }
        catch (BiometricDeviceException ex) { return Ok(new { ok = false, deviceCount = 0, message = ex.Message }); }
        catch (Exception ex) { return Ok(new { ok = false, deviceCount = 0, message = "تعذّر الاتصال: " + ex.Message }); }
    }

    private ObjectResult ZkInactive() =>
        StatusCode(StatusCodes.Status409Conflict,
            new ApiErrorEnvelope("ZK_MODE_INACTIVE",
                Message: "لم يتم ضبط اتصال منظومة ZKBioTime — أدخل عنوان الخادم وبيانات الدخول واحفظ الإعدادات"));

    [HttpGet("api/biometric/applicants/search")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Search(
        [FromQuery] string field,
        [FromQuery] string? q,
        CancellationToken ct)
        => Ok(await service.SearchApplicantsAsync(field, q ?? "", ct));

    [HttpGet("api/biometric/applicants/lookup")]
    public async Task<ActionResult<JsonObject>> Lookup(
        [FromQuery] string? applicantId,
        [FromQuery] string? nationalId,
        [FromQuery] string? barcode,
        CancellationToken ct)
    {
        var row = await service.GetApplicantAsync(applicantId, nationalId, barcode, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("api/biometric/enroll")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> Enroll([FromBody] JsonObject input, CancellationToken ct)
    {
        try { return Ok(await service.EnrollAsync(input, ct)); }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
        catch (BiometricAlreadyEnrolledException ex)
        {
            return Conflict(new ApiErrorEnvelope(
                "CONFLICT", ConflictCode: "BIOMETRIC_ALREADY_ENROLLED", Message: ex.Message));
        }
    }

    [HttpPost("api/biometric/enroll/link-previous")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> LinkPreviousEnrollment([FromBody] JsonObject input, CancellationToken ct)
        => Ok(await service.LinkPreviousEnrollmentAsync(input, ct));

    [HttpPost("api/biometric/verify")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> Verify([FromBody] JsonObject input, CancellationToken ct)
    {
        try { return Ok(await service.VerifyAsync(input, ct)); }
        catch (BiometricDeviceException ex) { return DeviceUnavailable(ex); }
    }

    /// <summary>
    /// Maps a device-side failure to a clean 503 envelope (mirrors the MOI
    /// gateway's controller-level handling). When <c>Biometric:Mode=real</c>
    /// but the device API isn't configured/reachable, the seam surfaces this
    /// instead of leaking a generic 500 — proving the swap is clean and the
    /// failure is attributable to the device, not the app.
    /// </summary>
    private ObjectResult DeviceUnavailable(BiometricDeviceException ex) =>
        StatusCode(StatusCodes.Status503ServiceUnavailable,
            new ApiErrorEnvelope("BIOMETRIC_DEVICE_UNAVAILABLE", Message: ex.Message));

    [HttpPost("api/biometric/gate-log")]
    [RequireBearerAuth]
    public async Task<ActionResult<JsonObject>> GateLog([FromBody] JsonObject input, CancellationToken ct)
        => Ok(await service.RecordGateLogAsync(input, ct));

    [HttpGet("api/biometric/verifications")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Verifications(
        [FromQuery] string? module,
        [FromQuery] bool failedOnly,
        CancellationToken ct)
        => Ok(await service.ListVerificationsAsync(module, failedOnly, ct));

    [HttpGet("api/biometric/gate-logs")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> GateLogs(CancellationToken ct)
        => Ok(await service.ListGateLogsAsync(ct));

    [HttpGet("api/biometric/audit")]
    public async Task<ActionResult<IReadOnlyList<JsonObject>>> Audit(CancellationToken ct)
        => Ok(await service.ListAuditLogsAsync(ct));

    [HttpGet("api/biometric/reports")]
    public async Task<ActionResult<object>> Reports(CancellationToken ct)
        => Ok(await service.ReportsAsync(ct));

    [HttpGet("api/biometric/presence")]
    public async Task<ActionResult<JsonObject>> Presence(CancellationToken ct)
        => Ok(await service.PresenceAsync(ct));

    [HttpGet("api/biometric/monitoring")]
    public async Task<ActionResult<object>> Monitoring(CancellationToken ct)
        => Ok(await service.MonitoringAsync(ct));
}
