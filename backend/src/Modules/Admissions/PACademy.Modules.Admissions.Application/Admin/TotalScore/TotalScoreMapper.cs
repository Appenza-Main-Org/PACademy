using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.TotalScore;

internal static class TotalScoreMapper
{
    public static TotalScoreConfigDto ToDto(TotalScoreConfig c)
    {
        var components = JsonSerializer.Deserialize<List<TotalScoreComponent>>(c.ComponentsJson) ?? [];
        var componentDtos = components
            .Select(comp => new TotalScoreComponentDto(comp.ExamKey, comp.Weight, comp.MinimumPassingScore))
            .ToList();
        return new TotalScoreConfigDto(
            c.Id, c.CycleId, c.ApplicantStream.ToString(),
            componentDtos, c.TotalScoreOutOf,
            c.UpdatedAt, c.UpdatedBy, Convert.ToBase64String(c.RowVersion));
    }
}
