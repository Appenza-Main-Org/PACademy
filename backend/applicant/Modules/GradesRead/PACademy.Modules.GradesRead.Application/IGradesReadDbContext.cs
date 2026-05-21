using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.GradesRead.Application;

public interface IGradesReadDbContext
{
    IQueryable<ApplicantGrade> ApplicantGrades { get; }
}
