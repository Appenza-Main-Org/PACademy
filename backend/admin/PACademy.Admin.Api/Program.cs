using PACademy.Admin.Api.Api;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Modules.Audit;
using PACademy.Admin.Api.Modules.Identity;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddLookupsModule(builder.Configuration);
builder.Services.AddAdmissionsModule(builder.Configuration);
builder.Services.AddIdentityModule(builder.Configuration);
builder.Services.AddAdminRecordsModule(builder.Configuration);
builder.Services.AddAuditModule();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("FrontendDev");

app.MapOpenApi();
app.MapScalarApiReference("/scalar");

app.UseAuthorization();
app.MapControllers();

await app.InitializeAdminDatabaseAsync();
await app.SeedLookupsAsync();
await app.SeedAdmissionsAsync();
await app.SeedIdentityAsync();
await app.SeedAdminRecordsAsync();

app.Run();
