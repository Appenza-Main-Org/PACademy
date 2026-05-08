using Microsoft.AspNetCore.Authentication;
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
