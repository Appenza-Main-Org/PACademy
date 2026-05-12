using Microsoft.AspNetCore.Authorization;
using PACademy.Api.Authorization;
using PACademy.Api.Hosting;
using PACademy.Api.Middleware;
using PACademy.Infrastructure;
using PACademy.Shared.Audit.Infrastructure;
using PACademy.Modules.Identity.Infrastructure;
using PACademy.Modules.ReferenceData.Infrastructure;
using PACademy.Modules.Workflows.Infrastructure;
using PACademy.Modules.Admissions.Infrastructure;
using PACademy.Modules.Committees.Infrastructure;
using PACademy.Modules.Notifications.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter(
                System.Text.Json.JsonNamingPolicy.CamelCase)));
builder.Services.AddOpenApi();

// Phase 5 module registrations (no-ops during scaffolding; populated as types are extracted)
builder.Services
    .AddAuditModule(builder.Configuration)
    .AddIdentityModule(builder.Configuration)
    .AddReferenceDataModule(builder.Configuration)
    .AddWorkflowsModule(builder.Configuration)
    .AddAdmissionsModule(builder.Configuration)
    .AddCommitteesModule(builder.Configuration)
    .AddNotificationsModule(builder.Configuration);

builder.Services.AddPaInfrastructure(builder.Configuration);

// Spec 007 — US4: Permission-based authorization
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionRequirementHandler>();
builder.Services.AddAuthorizationBuilder()
    .AddDefaultPolicy("default", p => p.RequireAuthenticatedUser());

// Spec 007 — Sweepers
builder.Services.AddHostedService<OtpExpirySweeper>();
builder.Services.AddHostedService<LockoutAutoUnlockSweeper>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<DbUpdateConcurrencyExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<SessionMiddleware>();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();
app.MapControllers();

// Phase 5: Split __EFMigrationsHistory into per-context tables (idempotent, dev/staging only)
await MigrationHistoryCutover.RunIfNeededAsync(
    app.Configuration, app.Environment,
    app.Logger, CancellationToken.None);

// Seed demo data when requested via CLI arg or env var
if (args.Contains("--seed-demo") ||
    string.Equals(builder.Configuration["SeedDemo"], "true", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<PACademy.Infrastructure.Seeding.DemoDataSeeder>();
    await seeder.SeedAsync(CancellationToken.None);
}

app.Run();

// Partial class so WebApplicationFactory<Program> in tests can access it
public partial class Program { }
