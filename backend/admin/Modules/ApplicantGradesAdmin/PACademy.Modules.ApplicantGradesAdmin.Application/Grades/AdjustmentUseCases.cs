using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed class AddAdjustmentUseCase(IApplicantGradesAdminDbContext db, IAuditApi audit)
{
    public async Task<(GradeRowDto? Ok, string? ErrorCode)> ExecuteAsync(int seat, AddAdjustmentRequest request, CancellationToken ct = default)
    {
        var row = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Seat == seat, ct)
            ?? throw new KeyNotFoundException("صف الدرجات غير موجود.");

        if (request.OverrideMax.HasValue)
            row.SetOverrideMax(request.OverrideMax.Value);

        var max = row.OverrideMax ?? row.ImportMax;
        if (max <= 0 || row.Total > max) return (null, ErrorCodes.ValidationFailed);

        var activeSum = row.Adjustments.Where(x => x.IsActive).Sum(x => x.Amount);
        var projected = row.Total + activeSum + request.Amount;
        if (projected > max || projected < 0) return (null, ErrorCodes.ValidationFailed);

        var label = GradeConstants.ReasonLabels.TryGetValue(request.Reason, out var reasonLabel)
            ? reasonLabel
            : GradeConstants.ReasonLabels[GradeConstants.ReasonOther];
        var adjustment = row.AddAdjustment(request.Reason, label, request.Note, request.Amount, request.By ?? "مسؤول النظام");
        db.ApplicantGradeAdjustments.Add(adjustment);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("grade.adjustment.create", "applicant_grade", request.By ?? "system", row.Id.ToString(), AuditOutcome.Success, "admin", ct);

        return (GradeMapper.ToDto(row), null);
    }
}

public sealed class ToggleAdjustmentUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<GradeRowDto> ExecuteAsync(int seat, Guid adjustmentId, ToggleAdjustmentRequest request, CancellationToken ct = default)
    {
        var row = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Seat == seat, ct)
            ?? throw new KeyNotFoundException("صف الدرجات غير موجود.");
        row.ToggleAdjustment(adjustmentId, request.IsActive);
        await db.SaveChangesAsync(ct);
        return GradeMapper.ToDto(row);
    }
}

public sealed class DeleteAdjustmentUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<GradeRowDto> ExecuteAsync(int seat, Guid adjustmentId, CancellationToken ct = default)
    {
        var row = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Seat == seat, ct)
            ?? throw new KeyNotFoundException("صف الدرجات غير موجود.");
        row.DeleteAdjustment(adjustmentId);
        await db.SaveChangesAsync(ct);
        return GradeMapper.ToDto(row);
    }
}

public sealed class UpdateOverrideMaxUseCase(IApplicantGradesAdminDbContext db)
{
    public async Task<(GradeRowDto? Ok, string? ErrorCode)> ExecuteAsync(int seat, UpdateOverrideMaxRequest request, CancellationToken ct = default)
    {
        var row = await db.ApplicantGrades
            .Include(x => x.Adjustments)
            .FirstOrDefaultAsync(x => x.Seat == seat, ct)
            ?? throw new KeyNotFoundException("صف الدرجات غير موجود.");

        if (request.OverrideMax.HasValue)
        {
            var max = request.OverrideMax.Value;
            var adjusted = row.Total + row.Adjustments.Where(x => x.IsActive).Sum(x => x.Amount);
            if (max <= 0 || row.Total > max || adjusted > max || adjusted < 0)
                return (null, ErrorCodes.ValidationFailed);
        }

        row.SetOverrideMax(request.OverrideMax);
        await db.SaveChangesAsync(ct);
        return (GradeMapper.ToDto(row), null);
    }
}
