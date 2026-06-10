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

    /// <summary>True when the row is missing MOI identity fields — e.g. a
    /// bare <see cref="CreateManual"/> row created before NID-derivation
    /// landed. Used by the login flow to decide whether to backfill.</summary>
    public bool IsIdentityIncomplete =>
        string.IsNullOrWhiteSpace(FullName) || DateOfBirth is null;

    /// <summary>
    /// Backfill MOI identity onto an existing row, filling only the fields
    /// that are still empty so any applicant-entered data is never
    /// clobbered. Self-heals rows created before NID-derivation existed.
    /// </summary>
    public void EnrichIdentity(
        string? fullName,
        string? email,
        string? gender,
        string? religion,
        DateOnly? dateOfBirth,
        string? birthGovernorate,
        string? birthDistrict)
    {
        if (string.IsNullOrWhiteSpace(FullName) && !string.IsNullOrWhiteSpace(fullName))
            FullName = fullName;
        if (string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(email))
            Email = email;
        if (string.IsNullOrWhiteSpace(Gender) && !string.IsNullOrWhiteSpace(gender))
            Gender = gender;
        if (string.IsNullOrWhiteSpace(Religion) && !string.IsNullOrWhiteSpace(religion))
            Religion = religion;
        if (DateOfBirth is null && dateOfBirth is not null)
            DateOfBirth = dateOfBirth;
        if (string.IsNullOrWhiteSpace(BirthGovernorate) && !string.IsNullOrWhiteSpace(birthGovernorate))
            BirthGovernorate = birthGovernorate;
        if (string.IsNullOrWhiteSpace(BirthDistrict) && !string.IsNullOrWhiteSpace(birthDistrict))
            BirthDistrict = birthDistrict;
        Source = "moi";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Swap a derived placeholder full name for a regenerated one. Callers
    /// must verify the current <see cref="FullName"/> is one of the retired
    /// derive-pool placeholders before invoking — applicant-entered names
    /// are never replaced through this path.
    /// </summary>
    public void ReplacePlaceholderName(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("name required", nameof(fullName));
        FullName = fullName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static void Guard(string nationalId, string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(nationalId)) throw new ArgumentException("nid required", nameof(nationalId));
        if (string.IsNullOrWhiteSpace(phoneNumber)) throw new ArgumentException("phone required", nameof(phoneNumber));
    }
}
