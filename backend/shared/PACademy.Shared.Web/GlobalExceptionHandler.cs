using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PACademy.Shared.Contracts;

namespace PACademy.Shared.Web;

/// <summary>
/// Global exception handler shared by both backends. Translates uncaught
/// exceptions into the canonical envelope shape
/// <c>{ code, conflictCode?, errors?, message, detail? }</c> already used
/// by typed handlers (controllers, validators) — so frontend clients see
/// a single response shape regardless of where the failure originated.
///
/// Uses the .NET 8+ <see cref="IExceptionHandler"/> abstraction; wired
/// from <see cref="ExceptionHandlingExtensions.AddPacademyExceptionHandling"/>.
/// </summary>
public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment env) : IExceptionHandler
{
    /// <summary>SQL Server: unique constraint / primary key violation.</summary>
    private const int SqlUniqueConstraintViolation = 2627;
    private const int SqlDuplicateKeyError = 2601;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, body) = Map(exception, env.IsDevelopment());

        logger.LogError(exception,
            "Unhandled {Type} on {Method} {Path} (traceId={TraceId}) → {Status}",
            exception.GetType().Name,
            httpContext.Request.Method,
            httpContext.Request.Path,
            httpContext.TraceIdentifier,
            status);

        httpContext.Response.Clear();
        httpContext.Response.StatusCode = status;
        httpContext.Response.ContentType = "application/json; charset=utf-8";
        await httpContext.Response.WriteAsJsonAsync(body, cancellationToken);
        return true;
    }

    private static (int Status, object Body) Map(Exception ex, bool isDev) => ex switch
    {
        /* FluentValidation — thrown by use cases that opt into
         * `validator.ValidateAndThrowAsync(...)`. Controllers that call
         * `ValidateAsync(...)` manually short-circuit before reaching here. */
        ValidationException ve => (StatusCodes.Status400BadRequest, new
        {
            code = ErrorCodes.ValidationFailed,
            errors = ve.Errors.ToDictionary(
                e => char.ToLowerInvariant(e.PropertyName[0]) + e.PropertyName[1..],
                e => e.ErrorMessage),
            message = "بيانات غير صالحة.",
        }),

        /* EF rowversion mismatch — the user-edited copy of the entity
         * is stale. Frontend should re-fetch and retry. */
        DbUpdateConcurrencyException => (StatusCodes.Status412PreconditionFailed, new
        {
            code = ErrorCodes.Conflict,
            conflictCode = ErrorCodes.DraftVersionConflict,
            message = "تم تعديل البيانات من جلسة أخرى. أعد تحميل الصفحة وحاول مرة أخرى.",
        }),

        /* EF unique-violation — application layer didn't catch the
         * duplicate; the SQL Server unique index did. Use case classes
         * SHOULD check first (so we return the right typed conflict code),
         * but this is the belt-and-braces fallback. */
        DbUpdateException due when IsUniqueViolation(due) => (StatusCodes.Status409Conflict, new
        {
            code = ErrorCodes.Conflict,
            conflictCode = ErrorCodes.LookupCodeDuplicate,
            message = "القيمة المُدخَلة مستخدمة مسبقاً.",
        }),

        /* EF FK violation / other update error — surface as 409 with
         * a generic message; details go to the log only. */
        DbUpdateException => (StatusCodes.Status409Conflict, new
        {
            code = ErrorCodes.Conflict,
            message = "تعذّر حفظ التغييرات بسبب تعارض في قاعدة البيانات.",
            detail = isDev ? ex.InnerException?.Message ?? ex.Message : null,
        }),

        /* Missing resource — use cases throw KeyNotFoundException when
         * the requested id doesn't resolve. */
        KeyNotFoundException knf => (StatusCodes.Status404NotFound, new
        {
            code = "NOT_FOUND",
            message = string.IsNullOrWhiteSpace(knf.Message) ? "السجل غير موجود." : knf.Message,
        }),

        UnauthorizedAccessException => (StatusCodes.Status403Forbidden, new
        {
            code = "FORBIDDEN",
            message = "غير مُصرَّح بهذا الإجراء.",
        }),

        /* Bad input that wasn't caught by FluentValidation — usually
         * thrown by entity factory methods like Faculty.Create("", ""). */
        ArgumentException ae => (StatusCodes.Status400BadRequest, new
        {
            code = ErrorCodes.ValidationFailed,
            message = ae.Message,
        }),

        /* Anything else — generic 500. In Dev expose the exception
         * detail; in Prod give a safe message and rely on logs. */
        _ => (StatusCodes.Status500InternalServerError, new
        {
            code = "INTERNAL_ERROR",
            message = "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.",
            detail = isDev ? ex.ToString() : null,
        }),
    };

    private static bool IsUniqueViolation(DbUpdateException due)
        => due.InnerException is SqlException sql
           && (sql.Number == SqlUniqueConstraintViolation || sql.Number == SqlDuplicateKeyError);
}
