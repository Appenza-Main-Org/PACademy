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
public sealed class ZkBioTimeClient(HttpClient http, IConfiguration config, IMemoryCache cache)
{
    private const string TokenCacheKey = "zkbiotime:jwt";

    private string BaseUrl => Cfg("BaseUrl")
        ?? throw new BiometricDeviceException("لم يتم ضبط عنوان منظومة ZKBioTime (Biometric:ZkBioTime:BaseUrl)");
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
        config[$"Biometric:ZkBioTime:{key}"] is { } v && !string.IsNullOrWhiteSpace(v) ? v : null;
    private int? CfgInt(string key) => int.TryParse(Cfg(key), out var n) ? n : null;
    private double? CfgDouble(string key) =>
        double.TryParse(Cfg(key), NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : null;

    /* ── Auth ──────────────────────────────────────────────────────── */

    /// <summary>Fetch (and cache) the JWT auth token. <paramref name="force"/> bypasses the cache.</summary>
    public async Task<string> GetTokenAsync(bool force, CancellationToken ct)
    {
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
    /// Recent punches for an employee since now − <paramref name="windowSeconds"/>.
    /// Only the lower bound is sent (clock-skew safe); the caller treats any
    /// returned row as a recent verification event. <c>ServerTimeUtcOffsetHours</c>
    /// shifts our computed start_time into the platform's local time.
    /// </summary>
    public async Task<IReadOnlyList<ZkTransaction>> GetRecentTransactionsAsync(
        string empCode, int windowSeconds, CancellationToken ct)
    {
        var start = DateTime.UtcNow
            .AddHours(ServerTimeUtcOffsetHours)
            .AddSeconds(-Math.Max(1, windowSeconds))
            .ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

        var body = await SendAsync(HttpMethod.Get,
            $"/iclock/api/transactions/?emp_code={Uri.EscapeDataString(empCode)}" +
            $"&start_time={Uri.EscapeDataString(start)}", null, ct);

        if (body?["data"] is not JsonArray rows) return [];
        return rows.OfType<JsonObject>()
            .Select(r => new ZkTransaction(
                r["emp_code"]?.GetValue<string>() ?? empCode,
                r["punch_time"]?.GetValue<string>() ?? "",
                ReadInt(r["verify_type"]),
                r["terminal_sn"]?.GetValue<string>()))
            .ToList();
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
        catch { return int.TryParse(node.ToString(), out var n) ? n : 0; }
    }
}

/// <summary>A single punch from the ZKBioTime transaction stream.</summary>
public sealed record ZkTransaction(string EmpCode, string PunchTime, int VerifyType, string? TerminalSn);
