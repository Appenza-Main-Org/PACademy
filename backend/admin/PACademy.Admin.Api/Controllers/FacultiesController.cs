using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.LookupsAdmin.Application.Faculties;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

/// <summary>
/// Admin CRUD for the faculties lookup.
/// Route shape mirrors <c>frontend/src/features/lookups/api/lookups.service.ts</c>:
///   <c>GET  /api/lookups/faculties</c>            — list
///   <c>POST /api/lookups/faculties</c>            — create
/// (PATCH/DELETE will land here as additional verbs.)
/// </summary>
[ApiController]
[Route("api/lookups/faculties")]
public sealed class FacultiesController(
    ListFacultiesUseCase listFaculties,
    CreateFacultyUseCase createFaculty,
    IValidator<CreateFacultyRequest> createValidator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        CancellationToken ct)
        => Ok(await listFaculties.ExecuteAsync(new ListFacultiesFilters(isActive, search), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFacultyRequest body, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(body, ct);
        if (!validation.IsValid)
        {
            return BadRequest(new
            {
                code = ErrorCodes.ValidationFailed,
                errors = validation.Errors.ToDictionary(
                    e => char.ToLowerInvariant(e.PropertyName[0]) + e.PropertyName[1..],
                    e => e.ErrorMessage),
            });
        }

        var (ok, errorCode) = await createFaculty.ExecuteAsync(body, ct);

        if (errorCode == ErrorCodes.LookupCodeDuplicate)
        {
            return Conflict(new
            {
                code = ErrorCodes.Conflict,
                conflictCode = errorCode,
                message = "كود الكلية مستخدم مسبقاً.",
            });
        }

        return CreatedAtAction(nameof(List), new { code = ok!.Code }, ok);
    }
}
