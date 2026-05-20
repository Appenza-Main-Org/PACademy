namespace PACademy.Modules.LookupsRead.Application;

/// <summary>
/// Public-facing faculty row sent to applicant clients. Strips audit
/// columns + row version that admin DTOs carry — applicants don't need
/// them and including them would leak edit history.
/// </summary>
public sealed record FacultyPublicDto(string Code, string Name);
