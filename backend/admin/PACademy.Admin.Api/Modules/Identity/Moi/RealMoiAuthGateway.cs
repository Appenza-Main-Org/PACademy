using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace PACademy.Admin.Api.Modules.Identity.Moi;

/// <summary>
/// Real MOI SSO gateway. Wired but dormant — selected only when
/// <c>Moi:Mode=real</c>. The HTTP shapes below match the ministry's integration
/// diagram verbatim; once the endpoint + credentials land in configuration this
/// becomes the live path with no change to <see cref="Controllers.AuthController"/>.
///
/// Required configuration (appsettings / env):
///   Moi:Mode      = real
///   Moi:BaseUrl   = https://&lt;moi-host&gt;
///   Moi:TokenPath = /token                          (optional, defaulted)
///   Moi:ValidatePath = /api/moiMemberApi/ValidateLogin (optional, defaulted)
/// </summary>
public sealed class RealMoiAuthGateway(HttpClient http, IConfiguration config) : IMoiAuthGateway
{
    private string BaseUrl => config["Moi:BaseUrl"]
        ?? throw new MoiAuthException("لم يتم ضبط عنوان خدمة وزارة الداخلية (Moi:BaseUrl)");
    private string TokenPath => config["Moi:TokenPath"] ?? "/token";
    private string ValidatePath => config["Moi:ValidatePath"] ?? "/api/moiMemberApi/ValidateLogin";

    public async Task<MoiTokenResponse> GetAccessTokenAsync(string userName, string password, CancellationToken ct)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["userName"] = userName,
            ["password"] = password,
            ["grant_type"] = "password",
        });

        using var res = await http.PostAsync($"{BaseUrl.TrimEnd('/')}{TokenPath}", form, ct);
        if (!res.IsSuccessStatusCode)
            throw new MoiAuthException("تعذر الحصول على رمز الدخول من وزارة الداخلية");

        var dto = await res.Content.ReadFromJsonAsync<TokenDto>(cancellationToken: ct)
            ?? throw new MoiAuthException("استجابة غير صالحة من وزارة الداخلية");
        return new MoiTokenResponse(dto.AccessToken, dto.TokenType ?? "bearer", dto.ExpiresIn);
    }

    public async Task<MoiValidateLoginResponse> ValidateLoginAsync(string email, string token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl.TrimEnd('/')}{ValidatePath}")
        {
            Content = JsonContent.Create(new { Email = email, Token = token }),
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var res = await http.SendAsync(request, ct);
        if (!res.IsSuccessStatusCode)
            throw new MoiAuthException("تعذر التحقق من بيانات الدخول لدى وزارة الداخلية");

        var dto = await res.Content.ReadFromJsonAsync<ValidateDto>(cancellationToken: ct)
            ?? throw new MoiAuthException("استجابة غير صالحة من وزارة الداخلية");

        var data = dto.Data is null
            ? null
            : new MoiMemberData(
                dto.Data.FullName ?? string.Empty,
                dto.Data.CardId ?? string.Empty,
                dto.Data.CardFactoryNumber,
                dto.Data.Email ?? string.Empty,
                dto.Data.MotherFirstName,
                dto.Data.Mobile ?? string.Empty,
                dto.Data.GovernorateId,
                dto.Data.Address,
                dto.Data.JobTitle);

        return new MoiValidateLoginResponse(dto.Status, dto.Message, data);
    }

    private sealed record TokenDto(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("token_type")] string? TokenType,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);

    private sealed record ValidateDto(
        [property: JsonPropertyName("status")] int Status,
        [property: JsonPropertyName("message")] string? Message,
        [property: JsonPropertyName("data")] MemberDto? Data);

    private sealed record MemberDto(
        [property: JsonPropertyName("fullName")] string? FullName,
        [property: JsonPropertyName("cardId")] string? CardId,
        [property: JsonPropertyName("cardFactoryNumber")] string? CardFactoryNumber,
        [property: JsonPropertyName("email")] string? Email,
        [property: JsonPropertyName("motherFirstName")] string? MotherFirstName,
        [property: JsonPropertyName("mobile")] string? Mobile,
        [property: JsonPropertyName("governorateId")] int GovernorateId,
        [property: JsonPropertyName("address")] string? Address,
        [property: JsonPropertyName("jobTitle")] string? JobTitle);
}
