using PACademy.Api.Middleware;
using PACademy.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddPaInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<SessionMiddleware>();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();
app.MapControllers();

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
