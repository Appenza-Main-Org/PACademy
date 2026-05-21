using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PACademy.Modules.IdentityApplicant.Application.Auth;
using PACademy.Shared.Domain.Identity;

namespace PACademy.Modules.IdentityApplicant.Infrastructure;

/// <summary>
/// HS256 JWT issuer for the applicant audience. Reads from config:
///   <c>Jwt:Issuer</c>          (default "applicant-api")
///   <c>Jwt:Audience</c>        (default "applicant-api")
///   <c>Jwt:SigningKey</c>      (required — 32+ chars in prod)
///   <c>Jwt:ExpiryHours</c>     (default 24)
///
/// Claims included:
///   <c>sub</c>       = applicant id (Guid)
///   <c>national_id</c>
///   <c>role</c>      = "applicant"
/// </summary>
public sealed class JwtTokenService(IConfiguration config) : IJwtTokenService
{
    public (string Token, long IssuedAtMs) Issue(Applicant applicant)
    {
        var signingKey = config["Jwt:SigningKey"]
            ?? throw new InvalidOperationException("Jwt:SigningKey is required.");
        var issuer = config["Jwt:Issuer"] ?? "applicant-api";
        var audience = config["Jwt:Audience"] ?? "applicant-api";
        var expiryHours = config.GetValue<int?>("Jwt:ExpiryHours") ?? 24;

        var now = DateTime.UtcNow;
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, applicant.Id.ToString()),
                new Claim("national_id", applicant.NationalId),
                new Claim(ClaimTypes.Role, "applicant"),
            },
            notBefore: now,
            expires: now.AddHours(expiryHours),
            signingCredentials: creds);

        var serialized = new JwtSecurityTokenHandler().WriteToken(token);
        var issuedAtMs = new DateTimeOffset(now).ToUnixTimeMilliseconds();
        return (serialized, issuedAtMs);
    }
}
