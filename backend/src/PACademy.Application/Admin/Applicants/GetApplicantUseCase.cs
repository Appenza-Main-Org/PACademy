using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Contracts.Admin.Applicants;

namespace PACademy.Application.Admin.Applicants;

public sealed class GetApplicantUseCase(IPaDbContext db)
{
    public async Task<ApplicantDetailDto?> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var applicant = await db.Applicants
            .AsNoTracking()
            .Where(a => a.Id == id && !a.Archived)
            .FirstOrDefaultAsync(ct);

        if (applicant is null) return null;

        string? lastModifiedBy = null;
        if (applicant.UpdatedBy.HasValue)
        {
            // Look up the actor's display name from the most recent audit entry
            // (audit table is the source of truth for who-did-what; cheap lookup
            // by composite index on TargetId + OccurredAt).
            lastModifiedBy = await db.AuditEntries
                .AsNoTracking()
                .Where(e => e.TargetId == applicant.Id && e.ActorId == applicant.UpdatedBy.Value)
                .OrderByDescending(e => e.OccurredAt)
                .Select(e => e.ActorName)
                .FirstOrDefaultAsync(ct);
        }

        return new ApplicantDetailDto(
            applicant.Id,
            applicant.NationalId,
            applicant.FullName,
            applicant.CycleId,
            applicant.Status.ToString(),
            applicant.DateOfBirth,
            applicant.Gender,
            applicant.Mobile,
            applicant.Email,
            applicant.Governorate,
            applicant.CreatedAt,
            applicant.UpdatedAt,
            applicant.CreatedBy,
            applicant.UpdatedBy,
            lastModifiedBy,
            applicant.DemoOrigin);
    }
}
