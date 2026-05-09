using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Admissions.Application.Dtos;
using PACademy.Modules.Identity.Public;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.Admissions.Application.Admin.Applicants;

public sealed class UpdateApplicantUseCase(IAdmissionsDbContext db, IIdentityApi identityApi)
{
    public async Task<ApplicantDetailDto?> ExecuteAsync(
        Guid id,
        ApplicantPatchDto patch,
        CancellationToken ct = default)
    {
        var actor = (await identityApi.GetCurrentUserAsync(ct))!;

        var applicant = await db.Applicants
            .Where(a => a.Id == id && !a.Archived)
            .FirstOrDefaultAsync(ct);

        if (applicant is null) return null;

        // Resolved Clarification #16: reject edits on locked (terminal-state) applicants.
        if (applicant.IsLocked)
        {
            throw new DomainConflictException(
                "هذا المتقدم موقوف · لا يمكن تعديل بياناته.",
                code: "APPLICANT_LOCKED");
        }

        var actorId = actor.Id;

        // Per-field PATCH — null = unchanged. Concurrent writes use silent
        // last-write-wins (FR-014).
        // Status is NOT accepted here (Resolved Clarification #15) — transitions
        // go through the dedicated /transition endpoint in a later phase.
        if (patch.FullName is not null && patch.FullName != applicant.FullName)
            applicant.UpdateFullName(patch.FullName, actorId);

        if (patch.Mobile is not null && patch.Mobile != applicant.Mobile)
            applicant.UpdateMobile(patch.Mobile, actorId);

        if (patch.Email is not null && patch.Email != applicant.Email)
            applicant.UpdateEmail(patch.Email, actorId);

        if (patch.Governorate is not null && patch.Governorate != applicant.Governorate)
            applicant.UpdateGovernorate(patch.Governorate, actorId);

        await db.SaveChangesAsync(ct);

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
            actor.FullName,
            applicant.DemoOrigin);
    }
}
