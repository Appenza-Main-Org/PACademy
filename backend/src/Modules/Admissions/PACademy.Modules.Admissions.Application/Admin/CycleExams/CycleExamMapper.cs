using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.CycleExams;

internal static class CycleExamMapper
{
    public static CycleExamDto ToDto(CycleExam e)
        => new(e.Id, e.CycleId, e.ExamTypeKey, e.CategoryId,
               e.Order, e.IsRequired, e.FeeEgp, e.IsArchived,
               e.CreatedAt, e.CreatedBy, Convert.ToBase64String(e.RowVersion));
}
