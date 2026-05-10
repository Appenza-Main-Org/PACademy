using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace PACademy.Modules.Identity.Application.Auth;

public sealed class OtpCodeHasher
{
    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    private const int Iterations = 10000;

    public string Hash(string code)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Pbkdf2(code, salt);
        return $"{Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string code, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 2) return false;

        try
        {
            var salt = Convert.FromBase64String(parts[0]);
            var expectedHash = Convert.FromBase64String(parts[1]);
            var actualHash = Pbkdf2(code, salt);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] Pbkdf2(string code, byte[] salt) =>
        KeyDerivation.Pbkdf2(
            password: code,
            salt: salt,
            prf: KeyDerivationPrf.HMACSHA256,
            iterationCount: Iterations,
            numBytesRequested: HashBytes);
}
