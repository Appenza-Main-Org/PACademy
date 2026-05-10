using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using PACademy.Modules.Identity.Application.Auth;

namespace PACademy.Modules.Identity.Infrastructure.Otp;

public sealed class InMemoryOtpTransport(
    ILogger<InMemoryOtpTransport> logger,
    IWebHostEnvironment env)
    : IOtpTransport
{
    // Keyed by masked phone tail for test consumption
    private static readonly ConcurrentDictionary<string, string> _lastCode = new();

    public Task<OtpDispatchResult> SendAsync(
        string maskedPhoneTail, string fullPhone, string code, CancellationToken ct = default)
    {
        _lastCode[maskedPhoneTail] = code;

        if (env.EnvironmentName is "Development" or "Testing")
            logger.LogInformation("OTP for {PhoneTail}: {Code}", maskedPhoneTail, code);

        return Task.FromResult(new OtpDispatchResult(true, $"in-mem-{Guid.NewGuid()}", null));
    }

    /// <summary>For test consumption only — reads the last dispatched code for a phone tail.</summary>
    public static string? PeekCode(string maskedPhoneTail) =>
        _lastCode.TryGetValue(maskedPhoneTail, out var code) ? code : null;

    /// <summary>For test teardown — clears all stored codes.</summary>
    public static void Clear() => _lastCode.Clear();
}
