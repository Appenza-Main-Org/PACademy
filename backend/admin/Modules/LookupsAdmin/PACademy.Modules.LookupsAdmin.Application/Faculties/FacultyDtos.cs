namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

/// <summary>
/// Admin-facing faculty row. Carries audit columns + row version so the
/// CRUD UI can show edit history and detect concurrent updates.
/// </summary>
public sealed record FacultyAdminDto(
    string Code,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string RowVersion);

public sealed record CreateFacultyRequest(string Code, string Name);
public sealed record UpdateFacultyRequest(string Name, bool IsActive);
