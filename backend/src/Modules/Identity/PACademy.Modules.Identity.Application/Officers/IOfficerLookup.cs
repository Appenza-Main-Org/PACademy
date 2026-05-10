namespace PACademy.Modules.Identity.Application.Officers;

public sealed record OfficerRecord(
    string NationalId,
    string OfficerCode,
    string FullName,
    string Mobile,
    string Email,
    DateTime IssueDate,
    string CardFactoryNumber,
    string Unit);

public sealed class OfficerLookupUnavailableException(string message, Exception? inner = null)
    : Exception(message, inner);

public interface IOfficerLookup
{
    /// <summary>
    /// Look up an officer by national ID and officer code.
    /// Returns null when the officer is not found (404).
    /// Throws <see cref="OfficerLookupUnavailableException"/> for transient upstream failures.
    /// </summary>
    Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct = default);
}
