using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Real device gateway. Dormant until <c>Biometric:Mode=real</c> and
/// <c>Biometric:BaseUrl</c> are set. Calls the device SDK's HTTP surface for
/// capture (enroll) and 1:1 match. Throws <see cref="BiometricDeviceException"/>
/// on any failure or missing configuration. Once the real device is available,
/// only config changes — no consumer code changes.
/// </summary>
public sealed class RealBiometricDeviceGateway(HttpClient http, IConfiguration config) : IBiometricDeviceGateway
{
    private string BaseUrl => config["Biometric:BaseUrl"] is { } url && !string.IsNullOrWhiteSpace(url)
        ? url
        : throw new BiometricDeviceException("لم يتم ضبط عنوان جهاز البصمة (Biometric:BaseUrl)");
    private string CapturePath => config["Biometric:CapturePath"] ?? "/api/biometric/capture";
    private string MatchPath => config["Biometric:MatchPath"] ?? "/api/biometric/match";

    public async Task<BiometricCaptureResult> CaptureAsync(BiometricCaptureRequest request, CancellationToken ct)
    {
        using var res = await http.PostAsJsonAsync($"{BaseUrl.TrimEnd('/')}{CapturePath}", request, ct);
        if (!res.IsSuccessStatusCode)
            throw new BiometricDeviceException("تعذر التقاط القياس الحيوي من الجهاز");
        var dto = await res.Content.ReadFromJsonAsync<CaptureDto>(cancellationToken: ct)
            ?? throw new BiometricDeviceException("استجابة غير صالحة من جهاز البصمة");
        return new BiometricCaptureResult(dto.TemplateRef, dto.Quality, dto.LivenessConfirmed);
    }

    public async Task<BiometricMatchResult> MatchAsync(BiometricMatchRequest request, CancellationToken ct)
    {
        using var res = await http.PostAsJsonAsync($"{BaseUrl.TrimEnd('/')}{MatchPath}", request, ct);
        if (!res.IsSuccessStatusCode)
            throw new BiometricDeviceException("تعذر التحقق من القياس الحيوي لدى الجهاز");
        var dto = await res.Content.ReadFromJsonAsync<MatchDto>(cancellationToken: ct)
            ?? throw new BiometricDeviceException("استجابة غير صالحة من جهاز البصمة");
        return new BiometricMatchResult(dto.IsMatch, dto.Confidence, dto.Score);
    }

    // The real-SDK stub exposes no personnel directory — never reports a duplicate.
    public Task<bool> EmployeeExistsAsync(string empCode, CancellationToken ct) => Task.FromResult(false);

    private sealed record CaptureDto(
        [property: JsonPropertyName("templateRef")] string TemplateRef,
        [property: JsonPropertyName("quality")] int Quality,
        [property: JsonPropertyName("livenessConfirmed")] bool LivenessConfirmed);

    private sealed record MatchDto(
        [property: JsonPropertyName("isMatch")] bool IsMatch,
        [property: JsonPropertyName("confidence")] int Confidence,
        [property: JsonPropertyName("score")] int Score);
}
