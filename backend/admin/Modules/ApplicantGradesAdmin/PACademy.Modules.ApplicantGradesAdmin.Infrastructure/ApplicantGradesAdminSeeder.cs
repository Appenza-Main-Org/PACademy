using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public static class ApplicantGradesAdminSeeder
{
    public static void MigrateAndSeed(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicantGradesAdminDbContext>();
        db.Database.Migrate();
        // The frontend applicant-grades mock starts with an empty STATE; imports populate it.
    }
}
