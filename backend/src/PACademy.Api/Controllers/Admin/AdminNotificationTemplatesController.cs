using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Notifications.Application.Templates;

namespace PACademy.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminNotificationTemplatesController(
    ListNotificationTemplatesUseCase list,
    GetNotificationTemplateUseCase get,
    CreateNotificationTemplateUseCase create,
    UpdateNotificationTemplateUseCase update,
    PublishNotificationTemplateUseCase publish,
    UnpublishNotificationTemplateUseCase unpublish,
    ArchiveNotificationTemplateUseCase archive,
    RestoreNotificationTemplateUseCase restore)
    : ControllerBase
{
    [HttpGet("admin/notification-templates")]
    public async Task<ActionResult<IReadOnlyList<NotificationTemplateDto>>> List(
        [FromQuery] Guid? cycleId = null,
        [FromQuery] string? triggerEvent = null,
        [FromQuery] bool? isPublished = null,
        CancellationToken ct = default)
        => Ok(await list.ExecuteAsync(cycleId, triggerEvent, isPublished, ct));

    [HttpGet("admin/notification-templates/{id:guid}")]
    public async Task<ActionResult<NotificationTemplateDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await get.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/notification-templates")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<NotificationTemplateDto>> Create(
        [FromBody] CreateNotificationTemplateRequest request, CancellationToken ct)
    {
        var dto = await create.ExecuteAsync(request, ct);
        return StatusCode(201, dto);
    }

    [HttpPatch("admin/notification-templates/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<NotificationTemplateDto>> Update(
        Guid id, [FromBody] UpdateNotificationTemplateRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/notification-templates/{id:guid}/publish")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<NotificationTemplateDto>> Publish(Guid id, CancellationToken ct)
    {
        var dto = await publish.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/notification-templates/{id:guid}/unpublish")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<NotificationTemplateDto>> Unpublish(Guid id, CancellationToken ct)
    {
        var dto = await unpublish.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/notification-templates/{id:guid}/archive")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<IActionResult> Archive(
        Guid id, [FromBody] ArchiveTemplateRequest request, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, request.Reason, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("admin/notification-templates/{id:guid}/restore")]
    [Authorize(Policy = "*")]
    public async Task<ActionResult<NotificationTemplateDto>> Restore(Guid id, CancellationToken ct)
    {
        var dto = await restore.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
