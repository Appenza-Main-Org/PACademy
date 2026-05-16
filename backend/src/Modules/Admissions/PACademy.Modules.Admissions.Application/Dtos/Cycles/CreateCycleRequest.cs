namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CreateCycleRequest(
    string NameAr,
    int Year,
    string Cohort,
    DateTime OpenDate,
    DateTime CloseDate);
