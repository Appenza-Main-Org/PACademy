using Microsoft.EntityFrameworkCore;
using PACademy.Modules.GradesRead.Application;
using PACademy.Shared.Domain.Grades;
using PACademy.Shared.Persistence.Grades;

namespace PACademy.Modules.GradesRead.Infrastructure;

public sealed class GradesReadDbContext(DbContextOptions<GradesReadDbContext> options)
    : DbContext(options), IGradesReadDbContext
{
    public DbSet<ApplicantGrade> ApplicantGradesSet => Set<ApplicantGrade>();
    public IQueryable<ApplicantGrade> ApplicantGrades => ApplicantGradesSet.AsNoTracking();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ApplicantGradeConfiguration());
        modelBuilder.ApplyConfiguration(new ApplicantGradeAdjustmentConfiguration());
        modelBuilder.ApplyConfiguration(new GradeImportBatchConfiguration());
        modelBuilder.ApplyConfiguration(new GradeImportRowConfiguration());
    }
}
