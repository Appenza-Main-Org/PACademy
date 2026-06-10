namespace PACademy.Admin.Api.Modules.Biometric;

/// <summary>
/// Normalized "Shape A" table for biometric enrollments, extracted from the JSON
/// <c>biometric_records</c> bucket (<c>module = 'biometric-enrollments'</c>).
///
/// House mirror strategy: typed columns own query/index/integrity; <see cref="PayloadJson"/>
/// keeps the full DTO verbatim (wire DTO: <c>BiometricEnrollmentRecord</c>, frontend
/// biometric feature). Fingerprint/face template refs are device blobs with no query
/// value — they stay inside the payload. The log buckets in the same operational table
/// (<c>biometric-verifications</c>, <c>biometric-gate-logs</c>, <c>biometric-audit</c>)
/// and the freeform <c>biometric-config</c> override map intentionally stay JSON.
/// </summary>
public sealed class BiometricEnrollmentEntity
{
    public required string Id { get; set; }
    public string? ApplicantId { get; set; }
    public string? NationalId { get; set; }
    public string? CycleId { get; set; }
    public string? Status { get; set; }
    public DateTimeOffset? EnrolledAt { get; set; }
    public string? EnrolledBy { get; set; }
    /// <summary>ZKBioTime employee code when device-linked (verify-by-NID path).</summary>
    public string? DeviceEmpCode { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
