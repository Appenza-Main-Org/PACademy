using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Admin.ExamDateConfigs;

internal static class ExamDateConfigMapper
{
    public static ExamDateConfigDto ToDto(ExamDateConfig c)
    {
        var bookable = JsonSerializer.Deserialize<List<string>>(c.BookableDaysJson) ?? [];
        var blackout = JsonSerializer.Deserialize<List<string>>(c.BlackoutDatesJson) ?? [];
        return new ExamDateConfigDto(
            c.Id, c.CycleId, c.FirstAvailableDate,
            bookable, blackout,
            c.UpdatedAt, c.UpdatedBy, Convert.ToBase64String(c.RowVersion));
    }
}
