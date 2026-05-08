using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.Applicants;

public sealed class Applicant : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string NationalId { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public Guid CycleId { get; private set; }
    public ApplicantStatus Status { get; private set; }
    public DateTime? DateOfBirth { get; private set; }
    public string? Gender { get; private set; }
    public string? Mobile { get; private set; }
    public string? Email { get; private set; }
    public string? Governorate { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    public IReadOnlyCollection<ApplicantStageSubmission> Submissions { get; private set; } = [];

    /// <summary>
    /// Resolved Clarification #16: applicant is locked when in a terminal
    /// human-decision state. PATCH on a locked applicant is rejected with
    /// HTTP 422 + code APPLICANT_LOCKED.
    /// </summary>
    public bool IsLocked => Status == ApplicantStatus.Deferred;

    private Applicant() { }

    public static Applicant Create(
        string nationalId,
        string fullName,
        Guid cycleId,
        Guid createdBy,
        bool demoOrigin = false)
    {
        return new Applicant
        {
            Id = Guid.NewGuid(),
            NationalId = nationalId,
            FullName = fullName,
            CycleId = cycleId,
            Status = ApplicantStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
            DemoOrigin = demoOrigin,
        };
    }

    public void UpdateStatus(ApplicantStatus newStatus, Guid updatedBy)
    {
        Status = newStatus;
        Touch(updatedBy);
    }

    public void UpdateFullName(string fullName, Guid updatedBy)
    {
        FullName = fullName;
        Touch(updatedBy);
    }

    public void UpdateMobile(string? mobile, Guid updatedBy)
    {
        Mobile = mobile;
        Touch(updatedBy);
    }

    public void UpdateEmail(string? email, Guid updatedBy)
    {
        Email = email;
        Touch(updatedBy);
    }

    public void UpdateGovernorate(string? governorate, Guid updatedBy)
    {
        Governorate = governorate;
        Touch(updatedBy);
    }

    private void Touch(Guid updatedBy)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
