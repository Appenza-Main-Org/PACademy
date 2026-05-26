using PACademy.Shared.Contracts;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

/// <summary>
/// Creates a new faculty row. Returns a tuple (Ok, ErrorCode):
///   • (dto, null)  on success
///   • (null, "LOOKUP_CODE_DUPLICATE")  when the code is taken
///
/// Controller maps the typed code to an HTTP envelope.
/// </summary>
public sealed class CreateFacultyUseCase(ILookupsAdminDbContext db)
{
    public async Task<(FacultyAdminDto? Ok, string? ErrorCode)> ExecuteAsync(
        CreateFacultyRequest request,
        CancellationToken ct = default)
    {
        var exists = await db.Faculties.FindAsync(new object?[] { request.Code }, ct);
        if (exists is not null) return (null, ErrorCodes.LookupCodeDuplicate);

        var entity = Faculty.Create(request.Code, request.Name);
        db.Faculties.Add(entity);
        await db.SaveChangesAsync(ct);

        var dto = new FacultyAdminDto(
            entity.Code,
            entity.Name,
            entity.IsActive,
            entity.CreatedAt,
            entity.UpdatedAt,
            Convert.ToBase64String(entity.RowVersion));
        return (dto, null);
    }
}
