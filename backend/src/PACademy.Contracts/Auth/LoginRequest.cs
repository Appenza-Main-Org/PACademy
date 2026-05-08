namespace PACademy.Contracts.Auth;

public sealed record LoginRequest(string NationalId, string Password);
