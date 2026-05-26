using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public interface IApplicantGradesAdminDbContext
{
    DbSet<ApplicantGrade> ApplicantGrades { get; }
    DbSet<ApplicantGradeAdjustment> ApplicantGradeAdjustments { get; }
    DbSet<GradeImportBatch> GradeImportBatches { get; }
    DbSet<GradeImportRow> GradeImportRows { get; }
    Task<int> SaveChangesAsync(CancellationToken ct);
}
