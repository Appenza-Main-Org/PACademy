using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ApplicantGradesAdmin.Application.Grades;
using PACademy.Shared.Domain.Grades;
using PACademy.Shared.Persistence.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public sealed class ApplicantGradesAdminDbContext(DbContextOptions<ApplicantGradesAdminDbContext> options)
    : DbContext(options), IApplicantGradesAdminDbContext
{
    public DbSet<ApplicantGrade> ApplicantGrades => Set<ApplicantGrade>();
    public DbSet<ApplicantGradeAdjustment> ApplicantGradeAdjustments => Set<ApplicantGradeAdjustment>();
    public DbSet<GradeImportBatch> GradeImportBatches => Set<GradeImportBatch>();
    public DbSet<GradeImportRow> GradeImportRows => Set<GradeImportRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ApplicantGradeConfiguration());
        modelBuilder.ApplyConfiguration(new ApplicantGradeAdjustmentConfiguration());
        modelBuilder.ApplyConfiguration(new GradeImportBatchConfiguration());
        modelBuilder.ApplyConfiguration(new GradeImportRowConfiguration());
    }

    Task<int> IApplicantGradesAdminDbContext.SaveChangesAsync(CancellationToken ct)
        => base.SaveChangesAsync(ct);
}
