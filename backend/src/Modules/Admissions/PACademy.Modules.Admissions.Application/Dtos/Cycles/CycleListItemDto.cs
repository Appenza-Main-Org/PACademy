namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CycleListItemDto(
    Guid Id,
    string NameAr,
    int Year,
    string Cohort,
    string Status,
    DateTime OpenDate,
    DateTime CloseDate,
    int ExpectedCapacity,
    int ApplicantCount);
