using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Identity.Moi;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Modules.Reports;
using PACademy.Admin.Api.Modules.Settings;
using PACademy.Admin.Api.Persistence;
using PACademy.Modules.LookupsAdmin.Infrastructure;
using PACademy.Modules.ApplicantGradesAdmin.Infrastructure;
using PACademy.Modules.IdentityApplicantAdmin.Infrastructure;
using PACademy.Shared.Web;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

/* ── Web API basics ─────────────────────────────────────────────── */
builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

/* ── Global exception handling ──────────────────────────────────── */
builder.Services.AddPacademyExceptionHandling();

/* ── OpenAPI (.NET 10 built-in) + Scalar UI ─────────────────────── */
builder.Services.AddOpenApi();

/* ── CORS — admin frontend + deployed Vercel origin ─────────────── */
var frontendOrigin = builder.Configuration["Cors:AdminFrontendOrigin"]
    ?? "http://localhost:5173";
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var envOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS")
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? [];
var corsOrigins = configuredOrigins
    .Concat(envOrigins)
    .Concat([
        frontendOrigin,
        "https://admin-staging.appenzademo.com",
        "https://pacademy-staging.vercel.app",
        "https://admin.appenzademo.com",
        "https://admin-prod.appenzademo.com",
        "https://appenzademo.com",
        "https://www.appenzademo.com",
        "https://pa-cademy.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ])
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();
const string CorsPolicyName = "admin-frontend";
builder.Services.AddCors(opt => opt.AddPolicy(CorsPolicyName, p => p
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

/* ── Internal modules (all share AdminDbContext) ────────────────── */
// LookupsModule registers AdminDbContext first; all others resolve it.
builder.Services.AddLookupsModule(builder.Configuration);
builder.Services.AddIdentityModule(builder.Configuration);
builder.Services.AddMoiAuthModule(builder.Configuration);
builder.Services.AddAdminRecordsModule(builder.Configuration);
builder.Services.AddAdmissionsModule(builder.Configuration);
builder.Services.AddAuditModule();
builder.Services.AddExamsModule(builder.Configuration);
builder.Services.AddReportsModule(builder.Configuration);
builder.Services.AddSettingsModule(builder.Configuration);

/* ── External legacy modules (separate DbContexts + migrations) ─── */
builder.Services.AddLookupsAdminModule(builder.Configuration);
builder.Services.AddApplicantGradesAdminModule(builder.Configuration);
builder.Services.AddIdentityApplicantAdminModule(builder.Configuration);

var app = builder.Build();

/* ── Apply migrations + idempotent seed ─────────────────────────── */
var database = app.Configuration.ResolveAdminDatabaseSettings();
var skipMigrationsAndSeed = args.Contains("--no-seed")
    || database.SkipMigrationsAndSeed;
var skipSeed = args.Contains("--skip-seed")
    || database.SkipSeed;

if (!skipMigrationsAndSeed)
{
    // Migrate the main AdminDbContext (covers portal tables, admission tables, etc.)
    await using (var scope = app.Services.CreateAsyncScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        if (db.Database.IsRelational())
            await db.Database.MigrateAsync();
    }
}

if (!skipMigrationsAndSeed && !skipSeed)
{
    // Seed each internal module (idempotent — skips rows that already exist).
    await app.SeedLookupsAsync();
    await app.SeedIdentityAsync();
    await app.SeedAdminRecordsAsync();
    await app.SeedAdmissionsAsync();
    await app.SeedExamsAsync();

    // External-module DbContexts (each owns its own migrations history table).
    LookupsAdminSeeder.MigrateAndSeed(app.Services);
    ApplicantGradesAdminSeeder.MigrateAndSeed(app.Services);
    IdentityApplicantAdminSeeder.MigrateAndSeed(app.Services);
}

/* ── HTTP pipeline ──────────────────────────────────────────────── */
app.UsePacademyExceptionHandling();

var openApiEnabled = app.Environment.IsStaging()
    || app.Environment.IsEnvironment("Uat");

if (openApiEnabled)
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o
        .WithTitle("PACademy Admin API")
        .WithTheme(ScalarTheme.Default));
}

/* ── Health endpoints ───────────────────────────────────────────── */
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "pacademy-admin-api",
    timestamp = DateTimeOffset.UtcNow
}));
app.MapGet("/health/db", async (AdminDbContext db, CancellationToken ct) =>
{
    var result = await db.Database.SqlQueryRaw<int>("SELECT CAST(1 AS int) AS [Value]").FirstAsync(ct);
    return Results.Ok(new
    {
        status = "ok",
        provider = db.Database.ProviderName,
        connectionName = database.ConnectionName,
        schema = database.Schema,
        skipMigrationsAndSeed = database.SkipMigrationsAndSeed,
        skipSeed = database.SkipSeed,
        useInMemory = database.UseInMemory,
        database = result,
        timestamp = DateTimeOffset.UtcNow
    });
});

app.UseCors(CorsPolicyName);
app.MapControllers();

app.Run();
