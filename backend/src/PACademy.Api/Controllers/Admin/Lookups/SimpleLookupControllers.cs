using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Application.Admin.Lookups.CommitteeTypes;
using PACademy.Application.Admin.Lookups.DegreeTypes;
using PACademy.Application.Admin.Lookups.EducationTypes;
using PACademy.Application.Admin.Lookups.ExamGroups;
using PACademy.Application.Admin.Lookups.ExamTypes;
using PACademy.Application.Admin.Lookups.Faculties;
using PACademy.Application.Admin.Lookups.Jobs;
using PACademy.Application.Admin.Lookups.MaritalStatuses;
using PACademy.Application.Admin.Lookups.NotificationDepartments;
using PACademy.Application.Admin.Lookups.RejectionReasons;
using PACademy.Application.Admin.Lookups.Specialties;
using PACademy.Application.Admin.Lookups.SpecialtyTypes;
using PACademy.Application.Admin.Lookups.Universities;
using PACademy.Contracts.Admin.Lookups;
using PACademy.Contracts.Common;

namespace PACademy.Api.Controllers.Admin.Lookups;

// All 13 simple-lookup controllers in one file. Each is structurally
// identical except for entity/use-case types and the route segment.

[ApiController, Route("admin/education-types"), Authorize(Policy = "*")]
public sealed class AdminEducationTypesController(
    ListEducationTypesUseCase list, GetEducationTypeUseCase get,
    CreateEducationTypeUseCase create, UpdateEducationTypeUseCase update,
    ArchiveEducationTypeUseCase archive, RestoreEducationTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<EducationTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EducationTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<EducationTypeDto>> Create([FromBody] CreateEducationTypeRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<EducationTypeDto>> Update(Guid id, [FromBody] UpdateEducationTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/marital-statuses"), Authorize(Policy = "*")]
public sealed class AdminMaritalStatusesController(
    ListMaritalStatusesUseCase list, GetMaritalStatusUseCase get,
    CreateMaritalStatusUseCase create, UpdateMaritalStatusUseCase update,
    ArchiveMaritalStatusUseCase archive, RestoreMaritalStatusUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<MaritalStatusDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MaritalStatusDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<MaritalStatusDto>> Create([FromBody] CreateMaritalStatusRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<MaritalStatusDto>> Update(Guid id, [FromBody] UpdateMaritalStatusRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/universities"), Authorize(Policy = "*")]
public sealed class AdminUniversitiesController(
    ListUniversitiesUseCase list, GetUniversityUseCase get,
    CreateUniversityUseCase create, UpdateUniversityUseCase update,
    ArchiveUniversityUseCase archive, RestoreUniversityUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UniversityDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UniversityDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<UniversityDto>> Create([FromBody] CreateUniversityRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<UniversityDto>> Update(Guid id, [FromBody] UpdateUniversityRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/faculties"), Authorize(Policy = "*")]
public sealed class AdminFacultiesController(
    ListFacultiesUseCase list, GetFacultyUseCase get,
    CreateFacultyUseCase create, UpdateFacultyUseCase update,
    ArchiveFacultyUseCase archive, RestoreFacultyUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<FacultyDto>>> List([FromQuery] FacultyListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<FacultyDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<FacultyDto>> Create([FromBody] CreateFacultyRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<FacultyDto>> Update(Guid id, [FromBody] UpdateFacultyRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/specialty-types"), Authorize(Policy = "*")]
public sealed class AdminSpecialtyTypesController(
    ListSpecialtyTypesUseCase list, GetSpecialtyTypeUseCase get,
    CreateSpecialtyTypeUseCase create, UpdateSpecialtyTypeUseCase update,
    ArchiveSpecialtyTypeUseCase archive, RestoreSpecialtyTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<SpecialtyTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SpecialtyTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<SpecialtyTypeDto>> Create([FromBody] CreateSpecialtyTypeRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<SpecialtyTypeDto>> Update(Guid id, [FromBody] UpdateSpecialtyTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/specialties"), Authorize(Policy = "*")]
public sealed class AdminSpecialtiesController(
    ListSpecialtiesUseCase list, GetSpecialtyUseCase get,
    CreateSpecialtyUseCase create, UpdateSpecialtyUseCase update,
    ArchiveSpecialtyUseCase archive, RestoreSpecialtyUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<SpecialtyDto>>> List([FromQuery] SpecialtyListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SpecialtyDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<SpecialtyDto>> Create([FromBody] CreateSpecialtyRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<SpecialtyDto>> Update(Guid id, [FromBody] UpdateSpecialtyRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/degree-types"), Authorize(Policy = "*")]
public sealed class AdminDegreeTypesController(
    ListDegreeTypesUseCase list, GetDegreeTypeUseCase get,
    CreateDegreeTypeUseCase create, UpdateDegreeTypeUseCase update,
    ArchiveDegreeTypeUseCase archive, RestoreDegreeTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<DegreeTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DegreeTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<DegreeTypeDto>> Create([FromBody] CreateDegreeTypeRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<DegreeTypeDto>> Update(Guid id, [FromBody] UpdateDegreeTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/jobs"), Authorize(Policy = "*")]
public sealed class AdminJobsController(
    ListJobsUseCase list, GetJobUseCase get,
    CreateJobUseCase create, UpdateJobUseCase update,
    ArchiveJobUseCase archive, RestoreJobUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<JobDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<JobDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<JobDto>> Create([FromBody] CreateJobRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<JobDto>> Update(Guid id, [FromBody] UpdateJobRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/exam-types"), Authorize(Policy = "*")]
public sealed class AdminExamTypesController(
    ListExamTypesUseCase list, GetExamTypeUseCase get,
    CreateExamTypeUseCase create, UpdateExamTypeUseCase update,
    ArchiveExamTypeUseCase archive, RestoreExamTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ExamTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExamTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<ExamTypeDto>> Create([FromBody] CreateExamTypeRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<ExamTypeDto>> Update(Guid id, [FromBody] UpdateExamTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/exam-groups"), Authorize(Policy = "*")]
public sealed class AdminExamGroupsController(
    ListExamGroupsUseCase list, GetExamGroupUseCase get,
    CreateExamGroupUseCase create, UpdateExamGroupUseCase update,
    ArchiveExamGroupUseCase archive, RestoreExamGroupUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ExamGroupDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExamGroupDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<ExamGroupDto>> Create([FromBody] CreateExamGroupRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<ExamGroupDto>> Update(Guid id, [FromBody] UpdateExamGroupRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/committee-types"), Authorize(Policy = "*")]
public sealed class AdminCommitteeTypesController(
    ListCommitteeTypesUseCase list, GetCommitteeTypeUseCase get,
    CreateCommitteeTypeUseCase create, UpdateCommitteeTypeUseCase update,
    ArchiveCommitteeTypeUseCase archive, RestoreCommitteeTypeUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CommitteeTypeDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CommitteeTypeDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<CommitteeTypeDto>> Create([FromBody] CreateCommitteeTypeRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<CommitteeTypeDto>> Update(Guid id, [FromBody] UpdateCommitteeTypeRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/rejection-reasons"), Authorize(Policy = "*")]
public sealed class AdminRejectionReasonsController(
    ListRejectionReasonsUseCase list, GetRejectionReasonUseCase get,
    CreateRejectionReasonUseCase create, UpdateRejectionReasonUseCase update,
    ArchiveRejectionReasonUseCase archive, RestoreRejectionReasonUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<RejectionReasonDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RejectionReasonDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<RejectionReasonDto>> Create([FromBody] CreateRejectionReasonRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<RejectionReasonDto>> Update(Guid id, [FromBody] UpdateRejectionReasonRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}

[ApiController, Route("admin/notification-departments"), Authorize(Policy = "*")]
public sealed class AdminNotificationDepartmentsController(
    ListNotificationDepartmentsUseCase list, GetNotificationDepartmentUseCase get,
    CreateNotificationDepartmentUseCase create, UpdateNotificationDepartmentUseCase update,
    ArchiveNotificationDepartmentUseCase archive, RestoreNotificationDepartmentUseCase restore)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<NotificationDepartmentDto>>> List([FromQuery] LookupListFilters f, CancellationToken ct)
    { var r = await list.ExecuteAsync(f, ct); Response.Headers["X-Total-Count"] = r.TotalCount.ToString(); Response.Headers["X-Page-Count"] = r.TotalPages.ToString(); return Ok(r); }
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NotificationDepartmentDto>> Get(Guid id, CancellationToken ct)
        => await get.ExecuteAsync(id, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost]
    public async Task<ActionResult<NotificationDepartmentDto>> Create([FromBody] CreateNotificationDepartmentRequest req, CancellationToken ct)
    { var d = await create.ExecuteAsync(req, ct); return CreatedAtAction(nameof(Get), new { id = d.Id }, d); }
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<NotificationDepartmentDto>> Update(Guid id, [FromBody] UpdateNotificationDepartmentRequest req, CancellationToken ct)
        => await update.ExecuteAsync(id, req, ct) is { } d ? Ok(d) : NotFound();
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => await archive.ExecuteAsync(id, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => await restore.ExecuteAsync(id, ct) ? NoContent() : NotFound();
}
