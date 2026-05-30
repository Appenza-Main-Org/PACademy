using System.Text;

namespace PACademy.Admin.Api.Infrastructure;

/// <summary>
/// Decodes the app session token (base64 of `userId:roleKey:issuedAtUnix`) that
/// <c>AuthController</c> issues, so controllers can identify the calling user
/// without a full auth middleware. This is a pragmatic seam for the simulated
/// auth phase; replace with claims-based auth when the real identity stack lands.
/// </summary>
public sealed record AuthActor(string UserId, string Role)
{
    public bool IsSuperAdmin => string.Equals(Role, "super_admin", StringComparison.Ordinal);

    public static AuthActor? FromRequest(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var token = header["Bearer ".Length..].Trim();
        if (string.IsNullOrWhiteSpace(token)) return null;

        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = raw.Split(':');
            if (parts.Length < 2) return null;
            return new AuthActor(parts[0], parts[1]);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
