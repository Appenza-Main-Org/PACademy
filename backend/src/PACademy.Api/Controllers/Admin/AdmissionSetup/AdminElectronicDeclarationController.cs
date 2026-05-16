using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;
using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;

namespace PACademy.Api.Controllers.Admin.AdmissionSetup;

[ApiController]
[Authorize(Policy = "admission-setup:read")]
public sealed class AdminElectronicDeclarationController(
    GetPublishedDeclarationUseCase getPublished,
    ListDeclarationVersionsUseCase listVersions,
    CreateDeclarationDraftUseCase createDraft,
    UpdateDeclarationUseCase update,
    PublishDeclarationUseCase publish,
    ArchiveDeclarationUseCase archive,
    IWebHostEnvironment env)
    : ControllerBase
{
    private const long MaxPdfBytes = 10L * 1024 * 1024;
    private const string PdfContentType = "application/pdf";

    [HttpGet("admin/admission-setup/cycles/{cycleId:guid}/declaration")]
    public async Task<ActionResult<ElectronicDeclarationDto?>> GetPublished(
        Guid cycleId, CancellationToken ct)
        => Ok(await getPublished.ExecuteAsync(cycleId, ct));

    [HttpGet("admin/admission-setup/cycles/{cycleId:guid}/declaration/versions")]
    public async Task<ActionResult<IReadOnlyList<ElectronicDeclarationDto>>> ListVersions(
        Guid cycleId, CancellationToken ct)
        => Ok(await listVersions.ExecuteAsync(cycleId, ct));

    [HttpPost("admin/admission-setup/cycles/{cycleId:guid}/declaration")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> CreateDraft(
        Guid cycleId, [FromBody] CreateDeclarationRequest request, CancellationToken ct)
    {
        var dto = await createDraft.ExecuteAsync(cycleId, request, ct);
        return StatusCode(201, dto);
    }

    [HttpPatch("admin/admission-setup/declaration/{id:guid}")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> Update(
        Guid id, [FromBody] UpdateDeclarationRequest request, CancellationToken ct)
    {
        var dto = await update.ExecuteAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/declaration/{id:guid}/publish")]
    [Authorize(Policy = "admission-setup:write")]
    public async Task<ActionResult<ElectronicDeclarationDto>> Publish(
        Guid id, CancellationToken ct)
    {
        var dto = await publish.ExecuteAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("admin/admission-setup/declaration/{id:guid}/archive")]
    [Authorize(Policy = "*")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var ok = await archive.ExecuteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>
    /// Uploads a PDF for the cycle's electronic declaration. Saves under
    /// wwwroot/uploads/declarations/{cycleId}/{guid}.pdf and returns the
    /// relative URL that the caller stores on the declaration record via
    /// the Create/Update endpoints.
    /// </summary>
    [HttpPost("admin/admission-setup/cycles/{cycleId:guid}/declaration/upload")]
    [Authorize(Policy = "admission-setup:write")]
    [RequestSizeLimit(MaxPdfBytes + 4096)]
    public async Task<ActionResult<UploadDeclarationDocumentResponse>> UploadDocument(
        Guid cycleId,
        [FromForm] IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "EMPTY_FILE", messageAr = "الملف فارغ" });

        if (file.Length > MaxPdfBytes)
            return StatusCode(StatusCodes.Status413PayloadTooLarge,
                new { code = "FILE_TOO_LARGE", messageAr = "حجم الملف يتجاوز الحد المسموح (10 ميجابايت)" });

        var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (contentType != PdfContentType || ext != ".pdf")
            return StatusCode(StatusCodes.Status415UnsupportedMediaType,
                new { code = "INVALID_FILE_TYPE", messageAr = "يجب أن يكون الملف بصيغة PDF" });

        var webroot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        var relativeDir = Path.Combine("uploads", "declarations", cycleId.ToString("D"));
        var absoluteDir = Path.Combine(webroot, relativeDir);
        Directory.CreateDirectory(absoluteDir);

        var storedFileName = $"{Guid.NewGuid():N}.pdf";
        var absolutePath = Path.Combine(absoluteDir, storedFileName);
        await using (var stream = System.IO.File.Create(absolutePath))
            await file.CopyToAsync(stream, ct);

        var publicUrl = "/" + Path.Combine(relativeDir, storedFileName)
            .Replace(Path.DirectorySeparatorChar, '/');
        return Ok(new UploadDeclarationDocumentResponse(file.FileName, publicUrl, file.Length));
    }
}
