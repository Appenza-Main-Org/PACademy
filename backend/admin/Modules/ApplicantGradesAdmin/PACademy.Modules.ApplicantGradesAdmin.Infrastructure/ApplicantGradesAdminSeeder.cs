using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Domain.Grades;

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

public static class ApplicantGradesAdminSeeder
{
    public static void MigrateAndSeed(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicantGradesAdminDbContext>();
        db.Database.Migrate();
        SeedDemoRowsAsync(db, CancellationToken.None).GetAwaiter().GetResult();
    }

    public static async Task SeedDemoRowsAsync(ApplicantGradesAdminDbContext db, CancellationToken ct = default)
    {
        const string demoNid = "30412180103456";
        if (await db.ApplicantGrades.AnyAsync(x => x.Nid == demoNid, ct)) return;

        db.ApplicantGrades.Add(ApplicantGrade.Create(
            seat: 142018,
            seatingNumber: "142018",
            nid: demoNid,
            name: "أحمد محمد إبراهيم سعد",
            kind: "general",
            gender: "male",
            branch: "علمي علوم",
            graduationYear: 2026,
            schoolCategoryCode: "SCH-01",
            school: "ثانوية النيل النموذجية",
            region: "القاهرة",
            examRound: null,
            total: 392m,
            importMax: 410m,
            status: "مستجد"));

        await db.SaveChangesAsync(ct);
    }
}
