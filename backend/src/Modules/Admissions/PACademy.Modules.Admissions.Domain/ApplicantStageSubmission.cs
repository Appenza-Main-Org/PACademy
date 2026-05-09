namespace PACademy.Modules.Admissions.Domain;

/// <summary>
/// Tracks per-stage form submission for the applicant portal wizard (11 stages).
/// Column-reserved for the future applicant-portal feature.
/// </summary>
public sealed class ApplicantStageSubmission
{
    public Guid Id { get; private set; }
    public Guid ApplicantId { get; private set; }
    public Applicant Applicant { get; private set; } = null!;
    public int StageNumber { get; private set; }
    public string? DataJson { get; private set; }
    public DateTime SubmittedAt { get; private set; }
    public DateTime? LastModifiedAt { get; private set; }

    private ApplicantStageSubmission() { }

    public static ApplicantStageSubmission Create(Guid applicantId, int stageNumber, string? dataJson = null)
    {
        return new ApplicantStageSubmission
        {
            Id = Guid.NewGuid(),
            ApplicantId = applicantId,
            StageNumber = stageNumber,
            DataJson = dataJson,
            SubmittedAt = DateTime.UtcNow,
        };
    }
}
