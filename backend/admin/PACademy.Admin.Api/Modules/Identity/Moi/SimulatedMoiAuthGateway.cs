using System.Text;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Identity.Moi;

/// <summary>
/// Stand-in for the ministry's MOI SSO endpoints until they go live.
///
/// It honours the exact two-call protocol against the local admin user store:
///   STEP 1  validates the generated username + password, mints a short-lived
///           opaque token that encodes the matched user id + expiry.
///   STEP 2  decodes that token, re-loads the user, checks the supplied email,
///           and returns the member's identity in the MOI `data` shape.
///
/// Tokens are deterministic in structure (base64 of `moi|userId|expUnix|nonce`)
/// so the real gateway can later return opaque tokens with no caller change.
/// </summary>
public sealed class SimulatedMoiAuthGateway(IIdentityDbContext db) : IMoiAuthGateway
{
    private const int TokenLifetimeSeconds = 3600;
    private const string TokenPrefix = "moi";

    public async Task<MoiTokenResponse> GetAccessTokenAsync(string userName, string password, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
            throw new MoiAuthException("اسم المستخدم وكلمة المرور مطلوبان");

        var user = await FindByUsernameAsync(userName, ct)
            ?? throw new MoiAuthException("بيانات الدخول غير صحيحة");

        var payload = IdentityJson.Parse(user.PayloadJson);
        var storedHash = IdentityJson.StringProp(payload, "passwordHash");
        if (!IdentityCredentials.VerifyPassword(password, storedHash))
            throw new MoiAuthException("بيانات الدخول غير صحيحة");

        if (user.AccountStatus != "active")
            throw new MoiAuthException("الحساب غير مفعّل");

        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(TokenLifetimeSeconds).ToUnixTimeSeconds();
        var nonce = Guid.NewGuid().ToString("N");
        var raw = $"{TokenPrefix}|{user.Id}|{expiresAt}|{nonce}";
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
        return new MoiTokenResponse(token, "bearer", TokenLifetimeSeconds);
    }

    public async Task<MoiValidateLoginResponse> ValidateLoginAsync(string email, string token, CancellationToken ct)
    {
        var userId = DecodeToken(token);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new MoiAuthException("الرمز غير صالح");

        var payload = IdentityJson.Parse(user.PayloadJson);
        var storedEmail = IdentityJson.StringProp(payload, "email");

        /* The real ValidateLogin keys on the email carried alongside the token.
         * When the caller passes an email, it must match the token's user. */
        if (!string.IsNullOrWhiteSpace(email)
            && !string.IsNullOrWhiteSpace(storedEmail)
            && !string.Equals(email.Trim(), storedEmail.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return new MoiValidateLoginResponse(0, "البريد الإلكتروني لا يطابق الرمز", null);
        }

        var data = new MoiMemberData(
            FullName: user.FullArabicName,
            CardId: user.NationalId,
            CardFactoryNumber: IdentityJson.StringProp(payload, "officerCode"),
            Email: storedEmail ?? string.Empty,
            MotherFirstName: IdentityJson.StringProp(payload, "motherFirstName"),
            Mobile: IdentityJson.StringProp(payload, "mobileNumber") ?? string.Empty,
            GovernorateId: ReadInt(payload, "governorateId"),
            Address: IdentityJson.StringProp(payload, "address"),
            JobTitle: user.Role);

        return new MoiValidateLoginResponse(1, null, data);
    }

    private async Task<UserEntity?> FindByUsernameAsync(string userName, CancellationToken ct)
    {
        var normalized = userName.Trim();
        /* Username lives inside PayloadJson, so we filter in memory. The admin user
         * set is small (tens of rows), so this is acceptable; the real gateway never
         * runs this path. */
        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        return users.FirstOrDefault(u =>
            string.Equals(
                IdentityJson.StringProp(IdentityJson.Parse(u.PayloadJson), "username"),
                normalized,
                StringComparison.OrdinalIgnoreCase));
    }

    private static string DecodeToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new MoiAuthException("الرمز مطلوب");
        string raw;
        try
        {
            raw = Encoding.UTF8.GetString(Convert.FromBase64String(token));
        }
        catch (FormatException)
        {
            throw new MoiAuthException("الرمز غير صالح");
        }

        var parts = raw.Split('|');
        if (parts.Length != 4 || parts[0] != TokenPrefix) throw new MoiAuthException("الرمز غير صالح");
        if (!long.TryParse(parts[2], out var expUnix)) throw new MoiAuthException("الرمز غير صالح");
        if (DateTimeOffset.FromUnixTimeSeconds(expUnix) < DateTimeOffset.UtcNow)
            throw new MoiAuthException("انتهت صلاحية الرمز");
        return parts[1];
    }

    private static int ReadInt(JsonObject obj, string key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node is null) return 0;
        try { return node.GetValue<int>(); }
        catch { return int.TryParse(node.ToString(), out var n) ? n : 0; }
    }
}
