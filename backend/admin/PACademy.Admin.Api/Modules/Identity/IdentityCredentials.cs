using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.Identity;

/// <summary>
/// Password hashing (PBKDF2-SHA256) + admin credential generation.
///
/// Credentials (username + password) live inside <see cref="UserEntity.PayloadJson"/>
/// under the keys <c>username</c> / <c>passwordHash</c> / <c>passwordUpdatedAt</c> /
/// <c>mustChangePassword</c>, so no schema migration is required. The plaintext
/// password is NEVER stored — only the salted hash. The generated plaintext is
/// returned once to the caller (shown in the UI on create / reset) and then lost.
/// </summary>
public static class IdentityCredentials
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 100_000;
    private static readonly HashAlgorithmName Algo = HashAlgorithmName.SHA256;

    /* Keys that must never leave the API in a user payload. */
    public static readonly string[] SensitiveKeys = ["passwordHash", "passwordSalt"];

    private const string UsernameAlphabet = "abcdefghijkmnpqrstuvwxyz0123456789";
    private const string PasswordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%*";

    /// <summary>Hash a plaintext password into a portable `pbkdf2$iter$salt$key` string.</summary>
    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, Algo, KeySize);
        return $"pbkdf2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
    }

    /// <summary>Constant-time verify of a plaintext password against a stored hash string.</summary>
    public static bool VerifyPassword(string password, string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return false;
        var parts = stored.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2") return false;
        if (!int.TryParse(parts[1], out var iterations)) return false;

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, Algo, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>
    /// Build a unique-ish username seed from the role + sequence. Final uniqueness
    /// is enforced by the caller against the existing user set.
    /// </summary>
    public static string BuildUsernameSeed(string roleKey, int sequence)
    {
        var prefix = roleKey switch
        {
            "super_admin" => "sadmin",
            "admissions_manager" => "amgr",
            "applicants_officer" => "aoff",
            "setup_admin" => "setup",
            "payments_officer" => "payoff",
            "auditor" => "audit",
            "exams_admin" => "exams",
            _ => "user"
        };
        return $"{prefix}{sequence:D3}";
    }

    /// <summary>Append a short random suffix to disambiguate a colliding username.</summary>
    public static string Randomize(string seed) => $"{seed}{RandomToken(UsernameAlphabet, 3)}";

    /// <summary>Generate a strong temporary password (12 chars, mixed classes).</summary>
    public static string GeneratePassword() => RandomToken(PasswordAlphabet, 12);

    private static string RandomToken(string alphabet, int length)
    {
        Span<char> buffer = stackalloc char[length];
        for (var i = 0; i < length; i++)
        {
            buffer[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        }
        return new string(buffer);
    }

    /// <summary>Remove hash/salt fields from a payload before returning it to a client.</summary>
    public static JsonObject Sanitize(JsonObject obj)
    {
        foreach (var key in SensitiveKeys) obj.Remove(key);
        return obj;
    }
}
