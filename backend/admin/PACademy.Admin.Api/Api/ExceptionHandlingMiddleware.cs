using System.Net;
using System.Text.Json;
using FluentValidation;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Api;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationException ex)
        {
            var errors = ex.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            await WriteAsync(context, HttpStatusCode.UnprocessableEntity, new ApiErrorEnvelope(
                ErrorCodes.ValidationFailed,
                Errors: errors,
                Message: "تحقق من البيانات المدخلة"));
        }
        catch (ConflictException ex)
        {
            await WriteAsync(context, HttpStatusCode.Conflict, new ApiErrorEnvelope(
                ErrorCodes.Conflict,
                ConflictCode: ex.ConflictCode,
                Message: ex.Message,
                Payload: ex.Payload));
        }
        catch (DependencyBlockedException ex)
        {
            await WriteAsync(context, HttpStatusCode.Conflict, new ApiErrorEnvelope(
                ErrorCodes.DependencyBlocked,
                ConflictCode: ex.DependencyCode,
                Message: ex.Message,
                Result: ex.Result));
        }
        catch (EntityNotFoundException ex)
        {
            await WriteAsync(context, HttpStatusCode.NotFound, new ApiErrorEnvelope(
                ErrorCodes.NotFound,
                Message: ex.Message));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled admin API error");
            await WriteAsync(context, HttpStatusCode.InternalServerError, new ApiErrorEnvelope(
                ErrorCodes.InternalError,
                Message: "حدث خطأ غير متوقع",
                Detail: context.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment() ? ex.Message : null));
        }
    }

    private static async Task WriteAsync(HttpContext context, HttpStatusCode status, ApiErrorEnvelope envelope)
    {
        if (context.Response.HasStarted) throw new InvalidOperationException("Response has already started.");
        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json; charset=utf-8";
        await JsonSerializer.SerializeAsync(context.Response.Body, envelope, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }
}
