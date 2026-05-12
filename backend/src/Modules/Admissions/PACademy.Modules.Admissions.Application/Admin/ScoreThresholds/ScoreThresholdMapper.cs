using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Application.Admin.ScoreThresholds;

internal static class ScoreThresholdMapper
{
    public static CommitteeScoreThresholdDto ToDto(CommitteeScoreThreshold t)
        => new(t.CycleId, t.CommitteeId, t.Min, t.Max,
               t.UpdatedAt, t.UpdatedBy, Convert.ToBase64String(t.RowVersion));
}
