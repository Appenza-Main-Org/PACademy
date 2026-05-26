using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Exams;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Lookups;
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
const string CorsPolicyName = "admin-frontend";
builder.Services.AddCors(opt => opt.AddPolicy(CorsPolicyName, p => p
    .WithOrigins(
        frontendOrigin,
        "https://appenzademo.com",
        "https://www.appenzademo.com")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

/* ── Internal modules (all share AdminDbContext) ────────────────── */
// LookupsModule registers AdminDbContext first; all others resolve it.
builder.Services.AddLookupsModule(builder.Configuration);
builder.Services.AddIdentityModule(builder.Configuration);
builder.Services.AddAdminRecordsModule(builder.Configuration);
builder.Services.AddAdmissionsModule(builder.Configuration);
builder.Services.AddAuditModule();
builder.Services.AddExamsModule(builder.Configuration);

/* ── External legacy modules (separate DbContexts + migrations) ─── */
builder.Services.AddLookupsAdminModule(builder.Configuration);
builder.Services.AddApplicantGradesAdminModule(builder.Configuration);
builder.Services.AddIdentityApplicantAdminModule(builder.Configuration);

var app = builder.Build();

/* ── Apply migrations + idempotent seed ─────────────────────────── */
var skipSeed = args.Contains("--no-seed")
    || app.Configuration.GetValue<bool>("SkipMigrationsAndSeed");

if (!skipSeed)
{
    // Migrate the main AdminDbContext (covers portal tables, admission tables, etc.)
    await using (var scope = app.Services.CreateAsyncScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        if (db.Database.IsRelational())
            await db.Database.MigrateAsync();
    }

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o
        .WithTitle("PACademy Admin API")
        .WithTheme(ScalarTheme.Default));
}

app.UseCors(CorsPolicyName);
app.MapControllers();

app.Run();
