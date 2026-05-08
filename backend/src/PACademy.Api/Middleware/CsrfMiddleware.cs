namespace PACademy.Api.Middleware;

internal sealed class CsrfMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SafeMethods = ["GET", "HEAD", "OPTIONS", "TRACE"];
    private const string CookieName = "csrf-token";
    private const string HeaderName = "X-CSRF-Token";

    public async Task InvokeAsync(HttpContext context)
    {
        var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();

        // Skip dev routes in Development
        if (context.Request.Path.StartsWithSegments("/dev") && env.IsDevelopment())
        {
            await next(context);
            return;
        }

        // Skip CSRF entirely in the Testing environment — integration tests
        // bypass the cookie+header dance via TestAuthHandler.
        if (env.IsEnvironment("Testing"))
        {
            await next(context);
            return;
        }

        if (!SafeMethods.Contains(context.Request.Method))
        {
            // Only enforce for authenticated requests
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var cookieToken = context.Request.Cookies[CookieName];
                var headerToken = context.Request.Headers[HeaderName].ToString();

                if (string.IsNullOrEmpty(cookieToken) ||
                    string.IsNullOrEmpty(headerToken) ||
                    !string.Equals(cookieToken, headerToken, StringComparison.Ordinal))
                {
                    context.Response.StatusCode = 403;
                    context.Response.Headers["Content-Type"] = "application/json";
                    await context.Response.WriteAsync(
                        """{"code":"CSRF_INVALID","message":"CSRF token mismatch."}""",
                        context.RequestAborted);
                    return;
                }
            }
        }

        // Issue the CSRF cookie if it doesn't exist yet (readable by the SPA — not HttpOnly)
        if (!context.Request.Cookies.ContainsKey(CookieName))
        {
            var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
            context.Response.Cookies.Append(CookieName, token, new CookieOptions
            {
                HttpOnly = false,
                SameSite = SameSiteMode.Strict,
                Secure = context.Request.IsHttps,
                Path = "/",
            });
        }

        await next(context);
    }
}
