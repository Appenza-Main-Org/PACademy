using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Contracts;

namespace PACademy.Shared.Web;

/// <summary>
/// DI + pipeline extensions for the shared exception handler. Wire from
/// both <c>PACademy.Admin.Api/Program.cs</c> and
/// <c>PACademy.Applicant.Api/Program.cs</c>:
///
/// <code>
/// builder.Services.AddPacademyExceptionHandling();
/// // …
/// app.UsePacademyExceptionHandling();
/// </code>
///
/// Must be the FIRST piece of middleware in the pipeline so it catches
/// everything downstream — call <c>UsePacademyExceptionHandling()</c>
/// before <c>UseCors()</c>, <c>UseAuthentication()</c>, etc.
/// </summary>
public static class ExceptionHandlingExtensions
{
    public static IServiceCollection AddPacademyExceptionHandling(this IServiceCollection services)
    {
        services.AddExceptionHandler<GlobalExceptionHandler>();
        // Required by AddExceptionHandler — provides the empty
        // ProblemDetails service that the host expects, even though our
        // handler writes its own envelope shape.
        services.AddProblemDetails();

        /* Model-binding validation runs BEFORE our middleware, so the
         * default `[ApiController]` factory would emit the framework's
         * ProblemDetails shape ({type, title, errors, traceId}). Override
         * it so deserialization / required-field failures use the same
         * envelope as everything else: { code, errors, message }. */
        services.Configure<ApiBehaviorOptions>(o =>
        {
            o.InvalidModelStateResponseFactory = ctx =>
            {
                var errors = ctx.ModelState
                    .Where(kvp => kvp.Value?.Errors.Count > 0)
                    .ToDictionary(
                        kvp => string.IsNullOrEmpty(kvp.Key)
                            ? "body"
                            : char.ToLowerInvariant(kvp.Key[0]) + kvp.Key[1..],
                        kvp => kvp.Value!.Errors.First().ErrorMessage);

                return new BadRequestObjectResult(new
                {
                    code = ErrorCodes.ValidationFailed,
                    errors,
                    message = "بيانات غير صالحة.",
                });
            };
        });

        return services;
    }

    public static IApplicationBuilder UsePacademyExceptionHandling(this IApplicationBuilder app)
        => app.UseExceptionHandler();
}
