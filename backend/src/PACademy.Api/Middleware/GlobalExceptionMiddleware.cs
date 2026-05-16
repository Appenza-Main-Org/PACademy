using FluentValidation;
using PACademy.Application.Audit;
using PACademy.Application.Common;
using PACademy.Domain.Audit;
using System.Text.Json;

namespace PACademy.Api.Middleware;

internal sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationException vex)
        {
            context.Response.StatusCode = 400;
            context.Response.ContentType = "application/problem+json";
            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc7807",
                title = "Validation failed",
                status = 400,
                errors = vex.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(e => e.ErrorMessage).ToArray()),
            };
            await context.Response.WriteAsync(JsonSerializer.Serialize(problem), context.RequestAborted);
        }
        catch (DomainConflictException dce)
        {
            // Resolved Clarification #19: domain-rule violations map to 422
            // (Unprocessable Entity). 409 reserved for true concurrency conflicts.
            await WriteConflictAsync(context, dce.Message, dce.Code);
        }
        catch (PACademy.Shared.Contracts.DomainConflictException dce)
        {
            // Modular use-cases (Modules.Admissions, Modules.Lookups, …)
            // throw the Shared.Contracts variant. Same 422 mapping.
            await WriteConflictAsync(context, dce.Message, dce.Code);
        }
        catch (UnauthorizedAccessException uae)
        {
            context.Response.StatusCode = 403;
            context.Response.ContentType = "application/problem+json";

            // Emit audit entry for permission-denied events
            try
            {
                var auditWriter = context.RequestServices.GetService<IAuditWriter>();
                if (auditWriter is not null)
                {
                    await auditWriter.RecordAsync(
                        AuditAction.PermissionDenied,
                        "HttpRequest",
                        Guid.Empty,
                        context.Request.Path,
                        AuditOutcome.PermissionDenied,
                        null,
                        null,
                        context.RequestAborted);
                }
            }
            catch (Exception auditEx)
            {
                logger.LogWarning(auditEx, "Failed to record permission-denied audit entry");
            }

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc7807",
                title = "Forbidden",
                status = 403,
                detail = uae.Message,
            };
            await context.Response.WriteAsync(JsonSerializer.Serialize(problem), context.RequestAborted);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/problem+json";
            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc7807",
                title = "Internal Server Error",
                status = 500,
            };
            await context.Response.WriteAsync(JsonSerializer.Serialize(problem), context.RequestAborted);
        }
    }

    private static async Task WriteConflictAsync(HttpContext context, string detail, string code)
    {
        context.Response.StatusCode = 422;
        context.Response.ContentType = "application/problem+json";
        var problem = new
        {
            type = "https://tools.ietf.org/html/rfc7807",
            title = "Unprocessable Entity",
            status = 422,
            detail,
            code,
        };
        await context.Response.WriteAsync(JsonSerializer.Serialize(problem), context.RequestAborted);
    }
}
