using PACademy.Modules.LookupsRead.Infrastructure;
using PACademy.Shared.Web;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

/* ── Web API basics ─────────────────────────────────────────────── */
builder.Services.AddControllers();

/* ── Global exception handling ──────────────────────────────────── */
builder.Services.AddPacademyExceptionHandling();

/* ── OpenAPI (.NET 10 built-in) + Scalar UI ─────────────────────── */
builder.Services.AddOpenApi();

/* ── CORS — allow the Vite frontend origin ──────────────────────── */
var frontendOrigin = builder.Configuration["Cors:ApplicantFrontendOrigin"]
    ?? "http://localhost:5173";
const string CorsPolicyName = "applicant-frontend";
builder.Services.AddCors(opt => opt.AddPolicy(CorsPolicyName, p => p
    .WithOrigins(frontendOrigin)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

/* ── Modules ────────────────────────────────────────────────────── */
builder.Services.AddLookupsReadModule(builder.Configuration);

var app = builder.Build();

/* ── Dev-only seeding (InMemory provider) ───────────────────────── */
if (app.Configuration.GetValue<bool>("UseInMemoryDatabase"))
{
    LookupsDevSeeder.SeedFacultiesIfEmpty(app.Services);
}

/* Exception handler is the FIRST middleware — catches anything
 * downstream and translates to the canonical envelope shape. */
app.UsePacademyExceptionHandling();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o
        .WithTitle("PACademy Applicant API")
        .WithTheme(ScalarTheme.Default));
}

app.UseCors(CorsPolicyName);
// Auth middleware lands here once IdentityApplicant module is wired:
// app.UseAuthentication();
// app.UseAuthorization();
app.MapControllers();

app.Run();
