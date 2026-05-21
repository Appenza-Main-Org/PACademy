using PACademy.Modules.LookupsAdmin.Infrastructure;
using PACademy.Modules.ApplicantGradesAdmin.Infrastructure;
using PACademy.Shared.Web;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

/* ── Web API basics ─────────────────────────────────────────────── */
builder.Services.AddControllers();

/* ── Global exception handling ──────────────────────────────────── */
builder.Services.AddPacademyExceptionHandling();

/* ── OpenAPI (.NET 10 built-in) + Scalar UI ─────────────────────── */
builder.Services.AddOpenApi();

/* ── CORS — admin frontend origins ──────────────────────────────── */
var frontendOrigins = (builder.Configuration["Cors:AdminFrontendOrigins"]
        ?? builder.Configuration["Cors:AdminFrontendOrigin"]
        ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
const string CorsPolicyName = "admin-frontend";
builder.Services.AddCors(opt => opt.AddPolicy(CorsPolicyName, p => p
    .WithOrigins(frontendOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

/* ── Modules ────────────────────────────────────────────────────── */
builder.Services.AddLookupsAdminModule(builder.Configuration);
builder.Services.AddApplicantGradesAdminModule(builder.Configuration);

var app = builder.Build();

/* ── Apply migrations + idempotent seed ──────────────────────────
 * Admin backend owns DDL — runs Migrate() on startup which is a no-op
 * after the first run. Skip with --no-seed for repeat boots if needed. */
var skipSeed = args.Contains("--no-seed")
    || app.Configuration.GetValue<bool>("SkipMigrationsAndSeed");
if (!skipSeed)
{
    LookupsAdminSeeder.MigrateAndSeed(app.Services);
    ApplicantGradesAdminSeeder.MigrateAndSeed(app.Services);
}

/* ── HTTP pipeline ──────────────────────────────────────────────── */
/* Exception handler is the FIRST middleware — catches anything
 * downstream and translates to the canonical envelope shape. */
app.UsePacademyExceptionHandling();

if (app.Environment.IsDevelopment())
{
    // /openapi/v1.json — the spec
    app.MapOpenApi();
    // /scalar — interactive API docs (replaces Swagger UI on .NET 10)
    app.MapScalarApiReference(o => o
        .WithTitle("PACademy Admin API")
        .WithTheme(ScalarTheme.Default));
}

app.UseCors(CorsPolicyName);
app.MapControllers();

app.Run();
