using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Domain.Identity;

namespace PACademy.Modules.IdentityApplicantAdmin.Infrastructure;

/// <summary>
/// Migrates the <c>applicants</c> table + seeds the three known demo
/// applicants (Ahmed / Khaled / Youssef). Mohamed (NID 30506200103456)
/// is intentionally NOT seeded — his login path is the not_found-in-MOI
/// branch, where the row is created on-demand.
///
/// Data copied VERBATIM from
/// <c>frontend/src/features/applicant-portal/lib/moi-session.mock.ts</c>
/// lines 57–69 (Ahmed), 103–115 (Khaled), 125–137 (Youssef).
/// </summary>
public static class IdentityApplicantAdminSeeder
{
    public static void MigrateAndSeed(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityApplicantAdminDbContext>();

        db.Database.Migrate();

        foreach (var (nid, factory) in Seed)
        {
            if (db.Applicants.Any(a => a.NationalId == nid)) continue;
            db.Applicants.Add(factory());
        }
        db.SaveChanges();
    }

    private static readonly (string Nid, Func<Applicant> Factory)[] Seed =
    [
        ("30412180103456", () => Applicant.CreateFromMoi(
            nationalId: "30412180103456",
            phoneNumber: "01012345678",
            fullName: "أحمد محمد إبراهيم سعد",
            email: "ahmed.ibrahim.saad@gmail.com",
            gender: "male",
            religion: "مسلم",
            dateOfBirth: new DateOnly(2004, 12, 18),
            birthGovernorate: "القاهرة",
            birthDistrict: "مدينة نصر")),
        ("28503150103456", () => Applicant.CreateFromMoi(
            nationalId: "28503150103456",
            phoneNumber: "01098765432",
            fullName: "خالد عبد الرحمن سامي مصطفى",
            email: "khaled.samy@gmail.com",
            gender: "male",
            religion: "مسلم",
            dateOfBirth: new DateOnly(1985, 3, 15),
            birthGovernorate: "الإسكندرية",
            birthDistrict: "سيدي جابر")),
        ("30407010103456", () => Applicant.CreateFromMoi(
            nationalId: "30407010103456",
            phoneNumber: "01098765432",
            fullName: "يوسف عمر فاروق منصور",
            email: "youssef.mansour@example.eg",
            gender: "male",
            religion: "مسلم",
            dateOfBirth: new DateOnly(2004, 7, 1),
            birthGovernorate: "الجيزة",
            birthDistrict: "الدقي")),
    ];
}
