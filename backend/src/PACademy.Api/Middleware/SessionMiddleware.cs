using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PACademy.Infrastructure.Persistence;
using System.Security.Claims;

namespace PACademy.Api.Middleware;

internal sealed class SessionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, PaDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        // Bypass the session-revocation check for anonymous endpoints.
        // The middleware runs before UseAuthorization, so [AllowAnonymous]
        // isn't consulted yet. Without this check, a user holding a stale
        // cookie whose DB session row is missing/revoked gets trapped out
        // of POST /auth/login/request-otp — the very endpoint needed to
        // recover. Match aspnetcore's own [AllowAnonymous] detection by
        // looking up the endpoint's metadata.
        if (context.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() is not null)
        {
            await next(context);
            return;
        }

        var sidClaim = context.User.FindFirstValue("sid");
        if (!Guid.TryParse(sidClaim, out var sessionId))
        {
            await next(context);
            return;
        }

        var session = await db.Sessions.FindAsync([sessionId], context.RequestAborted);
        if (session is null || session.RevokedAt.HasValue)
        {
            context.Response.StatusCode = 401;
            context.Response.Headers["Content-Type"] = "application/json";
            await context.Response.WriteAsync(
                """{"code":"SESSION_REVOKED","message":"Session has been revoked."}""",
                context.RequestAborted);
            return;
        }

        session.RefreshLastSeen();
        await db.SaveChangesAsync(context.RequestAborted);

        await next(context);
    }
}
