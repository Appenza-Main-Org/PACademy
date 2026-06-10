using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;

namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Thin typed client over the ZKBioTime / BioTime 8.x REST API — only the
/// endpoints that actually exist in the platform today:
///   • <c>POST {AuthPath}</c>                       — JWT auth token
///   • <c>GET/POST /personnel/api/employees/</c>     — personnel records
///   • <c>GET /iclock/api/transactions/</c>          — the device punch stream
///   • <c>GET /iclock/api/terminals/</c>             — registered terminals
///
/// The platform has NO synchronous capture/match (1:1 verify) endpoint —
/// biometric templates are enrolled on the terminal firmware, and verification
/// results surface only as transactions. The gateway built on this client
/// therefore models enrollment as "ensure a personnel record" and verification
/// as "poll the punch stream" — see <see cref="ZkBioTimeBiometricDeviceGateway"/>.
///
/// The JWT token is cached in <see cref="IMemoryCache"/> (the typed client is
/// transient, so a per-instance field would not survive across requests) and
/// re-fetched on a 401.
/// </summary>
public sealed class ZkBioTimeClient(
    HttpClient http, IConfiguration config, IMemoryCache cache, Modules.AdminRecords.OperationalRecordsService records)
{
    public const string TokenCacheKey = "zkbiotime:jwt";
    public const string ConfigBucket = "biometric-config";
    public const string ConfigId = "zkbiotime";

    // DB config overrides (set from the admin screen) beat appsettings. Loaded
    // once per client instance (the client is transient = per request scope).
    private Dictionary<string, string>? _overrides;

    private async Task EnsureConfigAsync(CancellationToken ct)
    {
        if (_overrides is not null) return;
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var rec = await records.GetAsync(ConfigBucket, ConfigId, ct);
        if (rec is not null)
            foreach (var kv in rec)
            {
                var s = kv.Value?.ToString();
                if (!string.IsNullOrWhiteSpace(s)) map[kv.Key] = s!;
            }
        _overrides = map;
    }

    private string BaseUrl => Cfg("BaseUrl")
        ?? throw new BiometricDeviceException("لم يتم ضبط عنوان منظومة ZKBioTime (Biometric:ZkBioTime:BaseUrl)");

    /// <summary>
    /// The resolved server URL (DB override from the admin screen first, then
    /// appsettings) or null when none is set. Non-throwing — used to decide
    /// whether ZKBioTime is active without a startup mode flag.
    /// </summary>
    public async Task<string?> GetBaseUrlOrNullAsync(CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        return Cfg("BaseUrl");
    }

    /// <summary>
    /// True once a server URL has been configured (from the admin screen or
    /// appsettings). This is the live activation switch for ZKBioTime — the
    /// integration turns on the moment the connection is saved, no redeploy.
    /// </summary>
    public async Task<bool> IsConfiguredAsync(CancellationToken ct)
        => !string.IsNullOrWhiteSpace(await GetBaseUrlOrNullAsync(ct));
    private string AuthPath => Cfg("AuthPath") ?? "/jwt-api-token-auth/";
    // Header scheme paired with AuthPath: "JWT" for /jwt-api-token-auth/, "Token" for /api-token-auth/.
    private string TokenScheme => Cfg("TokenScheme") ?? "JWT";
    private string Username => Cfg("Username")
        ?? throw new BiometricDeviceException("لم يتم ضبط اسم مستخدم ZKBioTime (Biometric:ZkBioTime:Username)");
    private string Password => Cfg("Password")
        ?? throw new BiometricDeviceException("لم يتم ضبط كلمة مرور ZKBioTime (Biometric:ZkBioTime:Password)");
    private int DefaultAreaId => CfgInt("DefaultAreaId") ?? 1;
    // Required by the employee-create API (per ZKBioTime docs), so it defaults to 1.
    private int DefaultDepartmentId => CfgInt("DefaultDepartmentId") ?? 1;
    private int TokenCacheMinutes => CfgInt("TokenCacheMinutes") ?? 50;
    private double ServerTimeUtcOffsetHours => CfgDouble("ServerTimeUtcOffsetHours") ?? 0;

    private string? Cfg(string key) =>
        (_overrides is not null && _overrides.TryGetValue(key, out var ov) && !string.IsNullOrWhiteSpace(ov) ? ov : null)
        ?? (config[$"Biometric:ZkBioTime:{key}"] is { } v && !string.IsNullOrWhiteSpace(v) ? v : null);
    private int? CfgInt(string key) => int.TryParse(Cfg(key), out var n) ? n : null;
    private double? CfgDouble(string key) =>
        double.TryParse(Cfg(key), NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : null;

    /* ── Auth ──────────────────────────────────────────────────────── */

    /// <summary>Fetch (and cache) the JWT auth token. <paramref name="force"/> bypasses the cache.</summary>
    public async Task<string> GetTokenAsync(bool force, CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        if (!force && cache.TryGetValue<string>(TokenCacheKey, out var cached) && !string.IsNullOrEmpty(cached))
            return cached!;

        using var res = await http.PostAsJsonAsync(
            Url(AuthPath), new { username = Username, password = Password }, ct);
        if (!res.IsSuccessStatusCode)
            throw new BiometricDeviceException("فشل تسجيل الدخول إلى منظومة ZKBioTime");

        var body = await res.Content.ReadFromJsonAsync<JsonNode>(cancellationToken: ct);
        var token = body?["token"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(token))
            throw new BiometricDeviceException("استجابة مصادقة غير صالحة من ZKBioTime");

        cache.Set(TokenCacheKey, token, TimeSpan.FromMinutes(TokenCacheMinutes));
        return token;
    }

    /// <summary>GET/POST helper that attaches the JWT and re-auths once on 401.</summary>
    private async Task<JsonNode?> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        async Task<HttpResponseMessage> Attempt(string token)
        {
            using var req = new HttpRequestMessage(method, Url(path));
            req.Headers.Authorization = new AuthenticationHeaderValue(TokenScheme, token);
            if (body is not null) req.Content = JsonContent.Create(body);
            return await http.SendAsync(req, ct);
        }

        var res = await Attempt(await GetTokenAsync(force: false, ct));
        if (res.StatusCode == HttpStatusCode.Unauthorized)
        {
            res.Dispose();
            res = await Attempt(await GetTokenAsync(force: true, ct));
        }

        using (res)
        {
            if (!res.IsSuccessStatusCode)
                throw new BiometricDeviceException($"فشل طلب ZKBioTime ({(int)res.StatusCode}) على {path}");
            return await res.Content.ReadFromJsonAsync<JsonNode>(cancellationToken: ct);
        }
    }

    /* ── Personnel ─────────────────────────────────────────────────── */

    /// <summary>Find an employee by <c>emp_code</c>; returns the record or null.</summary>
    public async Task<JsonObject?> FindEmployeeAsync(string empCode, CancellationToken ct)
    {
        var body = await SendAsync(HttpMethod.Get,
            $"/personnel/api/employees/?emp_code={Uri.EscapeDataString(empCode)}", null, ct);
        return body?["data"] is JsonArray { Count: > 0 } data ? data[0] as JsonObject : null;
    }

    /// <summary>
    /// Ensure a personnel record exists for the applicant (idempotent). Returns
    /// the existing or newly created employee object. Biometric templates are
    /// NOT pushed here (the API has no template endpoint) — they are captured on
    /// the terminal against this <c>emp_code</c>.
    /// </summary>
    public async Task<JsonObject> EnsureEmployeeAsync(string empCode, string firstName, CancellationToken ct)
    {
        if (await FindEmployeeAsync(empCode, ct) is { } existing) return existing;

        // emp_code + department + area are required by the ZKBioTime employee-create API.
        var payload = new JsonObject
        {
            ["emp_code"] = empCode,
            ["first_name"] = string.IsNullOrWhiteSpace(firstName) ? empCode : firstName,
            ["department"] = DefaultDepartmentId,
            ["area"] = new JsonArray { DefaultAreaId },
        };

        var created = await SendAsync(HttpMethod.Post, "/personnel/api/employees/", payload, ct) as JsonObject
            ?? throw new BiometricDeviceException("تعذر إنشاء سجل الموظف في ZKBioTime");
        return created;
    }

    /* ── Transactions (punch stream) ───────────────────────────────── */

    /// <summary>
    /// Recent punches for an employee within the last <paramref name="windowSeconds"/>.
    ///
    /// Clock-skew safe: filters on the platform-side <c>upload_time</c> (the
    /// server clock, when the punch was received) rather than the device-stamped
    /// <c>punch_time</c> — terminal RTCs drift (a G4 observed stamping 2023 in
    /// 2026), and a wrong device clock would otherwise silently fail every
    /// verification. We fetch newest-first by <c>ordering=-upload_time</c> and
    /// keep rows whose <c>upload_time</c> is within the window.
    /// <c>ServerTimeUtcOffsetHours</c> aligns "now" to the platform's local clock.
    /// </summary>
    public async Task<IReadOnlyList<ZkTransaction>> GetRecentTransactionsAsync(
        string empCode, int windowSeconds, string? terminalSn, CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        var serverNow = DateTime.UtcNow.AddHours(ServerTimeUtcOffsetHours);
        var cutoff = serverNow.AddSeconds(-Math.Max(1, windowSeconds));

        var url = $"/iclock/api/transactions/?emp_code={Uri.EscapeDataString(empCode)}" +
            "&ordering=-upload_time&page_size=25";
        if (!string.IsNullOrWhiteSpace(terminalSn))
            url += $"&terminal_sn={Uri.EscapeDataString(terminalSn)}";

        var body = await SendAsync(HttpMethod.Get, url, null, ct);

        if (body?["data"] is not JsonArray rows) return [];
        return rows.OfType<JsonObject>()
            .Select(ToTransaction)
            .Where(t => string.IsNullOrWhiteSpace(terminalSn) || t.TerminalSn == terminalSn)
            .Where(t => WithinWindow(t.UploadTime, cutoff))
            .ToList();
    }

    /// <summary>
    /// The single most-recent punch on ANY employee within the last
    /// <paramref name="windowSeconds"/> (server clock). Drives "identify from
    /// device" — the terminal does the 1:N match and stamps the emp_code.
    /// </summary>
    public async Task<ZkTransaction?> GetLatestTransactionAsync(
        int windowSeconds, string? terminalSn, CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        var serverNow = DateTime.UtcNow.AddHours(ServerTimeUtcOffsetHours);
        var cutoff = serverNow.AddSeconds(-Math.Max(1, windowSeconds));

        var url = "/iclock/api/transactions/?ordering=-upload_time&page_size=10";
        if (!string.IsNullOrWhiteSpace(terminalSn))
            url += $"&terminal_sn={Uri.EscapeDataString(terminalSn)}";

        var body = await SendAsync(HttpMethod.Get, url, null, ct);
        if (body?["data"] is not JsonArray rows) return null;
        return rows.OfType<JsonObject>()
            .Select(ToTransaction)
            // Defensive client-side filter in case the server ignores terminal_sn.
            .Where(t => string.IsNullOrWhiteSpace(terminalSn) || t.TerminalSn == terminalSn)
            .FirstOrDefault(t => WithinWindow(t.UploadTime, cutoff));
    }

    /// <summary>
    /// The most recent punches on ANY employee within the window (newest first),
    /// up to <paramref name="limit"/>. Drives the realtime identify feed.
    /// </summary>
    public async Task<IReadOnlyList<ZkTransaction>> GetRecentPunchesAsync(
        int windowSeconds, int limit, CancellationToken ct)
    {
        await EnsureConfigAsync(ct);
        var serverNow = DateTime.UtcNow.AddHours(ServerTimeUtcOffsetHours);
        var cutoff = serverNow.AddSeconds(-Math.Max(1, windowSeconds));

        var body = await SendAsync(HttpMethod.Get,
            $"/iclock/api/transactions/?ordering=-upload_time&page_size={Math.Clamp(limit, 1, 100)}",
            null, ct);
        if (body?["data"] is not JsonArray rows) return [];
        return rows.OfType<JsonObject>()
            .Select(ToTransaction)
            .Where(t => WithinWindow(t.UploadTime, cutoff))
            .ToList();
    }

    private static ZkTransaction ToTransaction(JsonObject r) => new(
        r["emp_code"]?.GetValue<string>() ?? "",
        r["punch_time"]?.GetValue<string>() ?? "",
        ReadInt(r["verify_type"]),
        r["terminal_sn"]?.GetValue<string>(),
        r["upload_time"]?.GetValue<string>(),
        r["first_name"]?.GetValue<string>(),
        r["verify_type_display"]?.GetValue<string>(),
        ReadInt(r["emp"]),
        r["area_alias"]?.GetValue<string>(),
        r["terminal_alias"]?.GetValue<string>());

    private static bool WithinWindow(string? uploadTime, DateTime cutoff) =>
        DateTime.TryParseExact(uploadTime, "yyyy-MM-dd HH:mm:ss",
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) && t >= cutoff;

    /// <summary>Registered employees (personnel), paged. Returns (rows, totalCount).</summary>
    public async Task<(IReadOnlyList<JsonObject> Rows, int Count)> ListEmployeesAsync(
        int page, int pageSize, CancellationToken ct)
    {
        var body = await SendAsync(HttpMethod.Get,
            $"/personnel/api/employees/?page={Math.Max(1, page)}&page_size={Math.Clamp(pageSize, 1, 500)}",
            null, ct);
        var rows = body?["data"] is JsonArray arr ? arr.OfType<JsonObject>().ToList() : [];
        return (rows, ReadInt(body?["count"]));
    }

    /* ── Terminals ─────────────────────────────────────────────────── */

    /// <summary>Registered terminals (devices). Useful for device-health surfaces.</summary>
    public async Task<IReadOnlyList<JsonObject>> ListTerminalsAsync(CancellationToken ct)
    {
        var body = await SendAsync(HttpMethod.Get, "/iclock/api/terminals/", null, ct);
        return body?["data"] is JsonArray rows ? rows.OfType<JsonObject>().ToList() : [];
    }

    private string Url(string path) => $"{BaseUrl.TrimEnd('/')}{path}";

    private static int ReadInt(JsonNode? node)
    {
        if (node is null) return 0;
        try { return node.GetValue<int>(); }
        catch (InvalidOperationException) { return int.TryParse(node.ToString(), out var n) ? n : 0; }
    }
}

/// <summary>A single punch from the ZKBioTime transaction stream.</summary>
public sealed record ZkTransaction(
    string EmpCode, string PunchTime, int VerifyType, string? TerminalSn,
    string? UploadTime = null, string? Name = null, string? VerifyTypeDisplay = null,
    int Emp = 0, string? AreaName = null, string? TerminalAlias = null);
