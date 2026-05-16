namespace PACademy.Contracts.Admin.Cycles;

public sealed record CreateCycleRequest(
    string NameAr,
    int Year,
    string Cohort,
    DateTime OpenDate,
    DateTime CloseDate);
