namespace PACademy.Contracts.Admin.Cycles;

public sealed record CycleListItemDto(
    Guid Id,
    string NameAr,
    int Year,
    string Cohort,
    string Status,
    DateTime OpenDate,
    DateTime CloseDate,
    int ApplicantCount);
