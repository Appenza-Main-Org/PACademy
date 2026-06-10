using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using PACademy.Applicant.Api.Modules.ApplicantPortal;
using PACademy.Modules.IdentityApplicant.Infrastructure;
using PACademy.Modules.LookupsRead.Infrastructure;
using PACademy.Modules.GradesRead.Infrastructure;
using PACademy.Shared.Web;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);


/* ── Web API basics ─────────────────────────────────────────────── */
builder.Services.AddControllers();

/* ── Global exception handling ──────────────────────────────────── */
builder.Services.AddPacademyExceptionHandling();

/* ── OpenAPI (.NET 10 built-in) + Scalar UI ─────────────────────── */
builder.Services.AddOpenApi();

/* ── CORS — origins driven by Cors:AllowedOrigins config array ───── */
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];
const string CorsPolicyName = "applicant-frontend";
builder.Services.AddCors(opt => opt.AddPolicy(CorsPolicyName, p => p
    .WithOrigins(["http://localhost:5173", .. allowedOrigins])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

/* ── Auth — JWT bearer, audience 'applicant-api' ────────────────── */
var jwtSigningKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey is required in appsettings.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "applicant-api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "applicant-api";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,           // rejects admin tokens (aud='admin-api')
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };
    });
builder.Services.AddAuthorization();

/* ── Modules ────────────────────────────────────────────────────── */
builder.Services.AddLookupsReadModule(builder.Configuration);
builder.Services.AddGradesReadModule(builder.Configuration);
builder.Services.AddIdentityApplicantModule(builder.Configuration);
builder.Services.AddApplicantPortalModule(builder.Configuration);
builder.Services.AddMemoryCache();

var app = builder.Build();

/* ── Dev-only seeding (InMemory provider) ───────────────────────── */
if (app.Configuration.GetValue<bool>("UseInMemoryDatabase"))
{
    LookupsDevSeeder.SeedFacultiesIfEmpty(app.Services);
}

/* Seed exam slots on every startup (idempotent — skips if already seeded). */
await PortalSeeder.SeedExamSlotsAsync(app.Services);

/* Regenerate retired derive-pool placeholder names for existing applicants
 * (idempotent — regenerated names can never match the legacy set again). */
await LegacyNameNormalizer.RegenerateLegacyNamesAsync(app.Services);

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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
