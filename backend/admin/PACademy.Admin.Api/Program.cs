using PACademy.Admin.Api.Api;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLookupsModule(builder.Configuration);
builder.Services.AddAdmissionsModule(builder.Configuration);
builder.Services.AddIdentityModule(builder.Configuration);
builder.Services.AddAdminRecordsModule(builder.Configuration);
builder.Services.AddAuditModule();
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var envOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS")
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? [];
var corsOrigins = configuredOrigins
    .Concat(envOrigins)
    .Concat([
        "https://admin.appenzademo.com",
        "https://appenzademo.com",
        "https://www.appenzademo.com",
        "https://pa-cademy.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ])
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AdminFrontend", policy =>
    {
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (!HttpMethods.IsOptions(context.Request.Method))
    {
        await next();
        return;
    }

    var origin = context.Request.Headers.Origin.ToString();
    if (corsOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
    {
        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.AccessControlAllowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders =
            context.Request.Headers.AccessControlRequestHeaders.ToString() is { Length: > 0 } requestedHeaders
                ? requestedHeaders
                : "content-type,authorization";
        context.Response.Headers.Vary = "Origin";
    }
    context.Response.StatusCode = StatusCodes.Status204NoContent;
});

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("AdminFrontend");

app.MapOpenApi();
app.MapScalarApiReference("/scalar");
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "pacademy-admin-api",
    timestamp = DateTimeOffset.UtcNow
}));
app.MapGet("/health/db", async (AdminDbContext db, CancellationToken ct) =>
{
    var result = await db.Database.SqlQueryRaw<int>("SELECT 1").FirstAsync(ct);
    return Results.Ok(new
    {
        status = "ok",
        database = result,
        timestamp = DateTimeOffset.UtcNow
    });
});

app.MapControllers();

await app.InitializeAdminDatabaseAsync();
await app.SeedLookupsAsync();
await app.SeedAdmissionsAsync();
await app.SeedIdentityAsync();
await app.SeedAdminRecordsAsync();

app.Run();
