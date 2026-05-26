namespace PACademy.Shared.Domain.Identity;

/// <summary>
/// Applicant authentication + identity record. Mirrors the frontend
/// <c>MoiApplicantSession</c> shape (see
/// <c>frontend/src/features/applicant-portal/lib/moi-session.mock.ts</c>)
/// so the login endpoint can return the same payload the frontend's
/// applicant-portal store already consumes.
///
/// Source field: <c>moi</c> when the row was populated from a MOI
/// verification, <c>manual</c> when the applicant logged in with a
/// not-in-MOI NID and we created a minimal row from the form input
/// (Mohamed demo flow).
/// </summary>
public sealed class Applicant
{
    private Applicant() { }

    public Guid Id { get; private set; }
    public string NationalId { get; private set; } = default!;
    public string PhoneNumber { get; private set; } = default!;
    public string? FullName { get; private set; }
    public string? Email { get; private set; }
    public string? Gender { get; private set; }      // 'male' | 'female'
    public string? Religion { get; private set; }    // 'مسلم' | 'مسيحي'
    public DateOnly? DateOfBirth { get; private set; }
    public string? BirthGovernorate { get; private set; }
    public string? BirthDistrict { get; private set; }
    /// <summary>'moi' or 'manual' — where the row data came from.</summary>
    public string Source { get; private set; } = "manual";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    /// <summary>Factory for applicants populated from a MOI verification.</summary>
    public static Applicant CreateFromMoi(
        string nationalId,
        string phoneNumber,
        string fullName,
        string email,
        string gender,
        string religion,
        DateOnly dateOfBirth,
        string birthGovernorate,
        string birthDistrict)
    {
        Guard(nationalId, phoneNumber);
        var now = DateTimeOffset.UtcNow;
        return new Applicant
        {
            Id = Guid.NewGuid(),
            NationalId = nationalId,
            PhoneNumber = phoneNumber,
            FullName = fullName,
            Email = email,
            Gender = gender,
            Religion = religion,
            DateOfBirth = dateOfBirth,
            BirthGovernorate = birthGovernorate,
            BirthDistrict = birthDistrict,
            Source = "moi",
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    /// <summary>
    /// Factory for the not_found-in-MOI path — minimal row from form
    /// input. The applicant will fill in the rest during Stage345.
    /// </summary>
    public static Applicant CreateManual(string nationalId, string phoneNumber)
    {
        Guard(nationalId, phoneNumber);
        var now = DateTimeOffset.UtcNow;
        return new Applicant
        {
            Id = Guid.NewGuid(),
            NationalId = nationalId,
            PhoneNumber = phoneNumber,
            Source = "manual",
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void UpdatePhoneNumber(string newPhoneNumber)
    {
        if (string.IsNullOrWhiteSpace(newPhoneNumber))
            throw new ArgumentException("phone required", nameof(newPhoneNumber));
        PhoneNumber = newPhoneNumber;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static void Guard(string nationalId, string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(nationalId)) throw new ArgumentException("nid required", nameof(nationalId));
        if (string.IsNullOrWhiteSpace(phoneNumber)) throw new ArgumentException("phone required", nameof(phoneNumber));
    }
}
