namespace PACademy.Modules.Identity.Application.Auth;

public sealed record OtpDispatchResult(bool Succeeded, string? MessageId, string? ErrorMessage);

public interface IOtpTransport
{
    Task<OtpDispatchResult> SendAsync(
        string maskedPhoneTail,
        string fullPhone,
        string code,
        CancellationToken ct = default);
}
