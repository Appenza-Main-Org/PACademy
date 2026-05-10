using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;
using PACademy.Modules.Identity.Domain;
using PACademy.Modules.Identity.Infrastructure.Otp;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace PACademy.Api.Tests.Auth;

/// <summary>
/// T421–T425a — OTP login flow integration tests.
/// Tests hit real HTTP endpoints against a Testcontainers SQL Server instance
/// with both PaDbContext and IdentityDbContext migrated.
/// InMemoryOtpTransport (Testing environment) exposes codes via PeekCode().
/// </summary>
[Collection("Identity")]
public sealed class OtpFlowTests : IAsyncLifetime
{
    private const string TestNationalId = "12345678901234";
    private const string TestPassword = "TestPass123!";
    private const string TestMobile = "01012345678";
    private const string TestFullName = "مستخدم اختبار";

    private OtpApiFactory _factory = null!;
    private HttpClient _client = null!;

    public OtpFlowTests(IdentityFixture fixture)
    {
        _factory = new OtpApiFactory(fixture);
    }

    public async Task InitializeAsync()
    {
        _client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

        // Seed a test user via the module's UserManager
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<SystemUser>>();

        var existing = await userManager.FindByNameAsync(TestNationalId);
        if (existing is null)
        {
            var user = new SystemUser
            {
                Id = Guid.NewGuid(),
                UserName = TestNationalId,
                NationalId = TestNationalId,
                OfficerCode = "OTP001",
                FullName = TestFullName,
                Mobile = TestMobile,
                PhoneNumber = TestMobile,
                Email = "otp-test@test.local",
                IsActive = true,
                Role = "super_admin",
                IssueDate = DateTime.UtcNow,
                CardFactoryNumber = "OTPTEST001",
                CreatedAt = DateTime.UtcNow,
            };
            var result = await userManager.CreateAsync(user, TestPassword);
            result.Succeeded.Should().BeTrue(
                $"Failed to create test user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        InMemoryOtpTransport.Clear();
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }

    // ── T421: Request OTP happy-path ──────────────────────────────────────────
    [Fact]
    public async Task RequestOtp_ValidCredentials_Returns200WithPendingId()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login/request-otp", new
        {
            nationalId = TestNationalId,
            password = TestPassword,
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("pendingId").GetGuid().Should().NotBeEmpty();
        body.GetProperty("otpDevice").GetString().Should().Contain("????");
        body.GetProperty("otpExpiresAt").GetDateTime().Should().BeAfter(DateTime.UtcNow);
    }

    // ── T422: Full OTP round-trip — correct code → session cookie ─────────────
    [Fact]
    public async Task VerifyOtp_CorrectCode_Returns200WithSessionCookie()
    {
        // Step 1: request OTP
        var requestResp = await _client.PostAsJsonAsync("/auth/login/request-otp", new
        {
            nationalId = TestNationalId,
            password = TestPassword,
        });
        requestResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var requestBody = await requestResp.Content.ReadFromJsonAsync<JsonElement>();
        var pendingId = requestBody.GetProperty("pendingId").GetGuid();
        var phoneTail = requestBody.GetProperty("otpDevice").GetString()!;

        // Step 2: retrieve code from in-memory transport and verify
        var code = InMemoryOtpTransport.PeekCode(phoneTail);
        code.Should().NotBeNullOrEmpty("InMemoryOtpTransport should have captured the code");

        var verifyResp = await _client.PostAsJsonAsync("/auth/login/verify-otp", new
        {
            pendingId,
            code,
        });

        verifyResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyBody = await verifyResp.Content.ReadFromJsonAsync<JsonElement>();
        verifyBody.GetProperty("userId").GetGuid().Should().NotBeEmpty();
        verifyBody.GetProperty("nationalId").GetString().Should().Be(TestNationalId);
        verifyBody.GetProperty("role").GetString().Should().Be("super_admin");

        // Session cookie should be set
        verifyResp.Headers.TryGetValues("Set-Cookie", out var cookies);
        cookies.Should().Contain(c => c.StartsWith("pa-session", StringComparison.OrdinalIgnoreCase));
    }

    // ── T423: Wrong OTP code returns 400 with remaining attempts ──────────────
    [Fact]
    public async Task VerifyOtp_WrongCode_Returns400WithRemainingAttempts()
    {
        var requestResp = await _client.PostAsJsonAsync("/auth/login/request-otp", new
        {
            nationalId = TestNationalId,
            password = TestPassword,
        });
        requestResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var requestBody = await requestResp.Content.ReadFromJsonAsync<JsonElement>();
        var pendingId = requestBody.GetProperty("pendingId").GetGuid();

        var verifyResp = await _client.PostAsJsonAsync("/auth/login/verify-otp", new
        {
            pendingId,
            code = "000000",
        });

        verifyResp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await verifyResp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("code").GetString().Should().Be("otp_mismatch");
        body.GetProperty("payload").GetProperty("remainingAttempts").GetInt32().Should().BeGreaterThan(0);
    }

    // ── T424: Wrong credentials → 401 ─────────────────────────────────────────
    [Fact]
    public async Task RequestOtp_InvalidCredentials_Returns401()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login/request-otp", new
        {
            nationalId = TestNationalId,
            password = "WrongPassword999!",
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("code").GetString().Should().Be("invalid_credentials");
    }

    // ── T425a: Legacy /auth/login → 410 Gone ─────────────────────────────────
    [Fact]
    public async Task LegacyLogin_Returns410Gone()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login", new
        {
            nationalId = TestNationalId,
            password = TestPassword,
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Gone);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("code").GetString().Should().Be("deprecated");
    }
}
