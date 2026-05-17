using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Application.ApplicationSettings;

internal static class AppSettingsMapper
{
    internal static ApplicantCategoryConfigDto ToDto(ApplicantCategoryConfig c) => new(
        c.Id.ToString(),
        c.CategoryId,
        c.IsActive,
        c.SortOrder,
        c.CreatedAt.ToString("O"),
        c.UpdatedAt.ToString("O"),
        Convert.ToBase64String(c.RowVersion));

    internal static ApplicantCategorySpecializationDto ToDto(ApplicantCategorySpecialization s) => new(
        s.Id.ToString(),
        s.ConfigId.ToString(),
        s.SpecializationId,
        s.IsActive,
        s.CreatedAt.ToString("O"),
        Convert.ToBase64String(s.RowVersion));

    internal static ApplicantSpecializationYearDto ToDto(ApplicantSpecializationYear y) => new(
        y.Id.ToString(),
        y.CategorySpecializationId.ToString(),
        AppSettingsValidation.DeserializeInts(y.GraduationYearsJson),
        AppSettingsValidation.DeserializeStrings(y.GenderTypesJson),
        AppSettingsValidation.DeserializeStrings(y.MaritalStatusCodesJson),
        AppSettingsValidation.DeserializeStrings(y.DivisionCodesJson),
        AppSettingsValidation.DeserializeStrings(y.SchoolCategoryCodesJson),
        y.AgeMin,
        y.MaxAge,
        y.ApplicationStartDate.ToString("yyyy-MM-dd"),
        y.ApplicationEndDate.ToString("yyyy-MM-dd"),
        y.AgeReferenceDate.ToString("yyyy-MM-dd"),
        y.IsActive,
        y.GradeKind,
        y.MinPercentage,
        y.AcademicGradeId,
        y.CreatedAt.ToString("O"),
        y.UpdatedAt.ToString("O"),
        Convert.ToBase64String(y.RowVersion));
}
