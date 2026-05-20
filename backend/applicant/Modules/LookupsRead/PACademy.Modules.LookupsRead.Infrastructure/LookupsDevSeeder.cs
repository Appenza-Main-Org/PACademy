using Microsoft.Extensions.DependencyInjection;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsRead.Infrastructure;

/// <summary>
/// Dev/demo-only seeder. Populates the in-memory lookup tables with the
/// same 18 faculties the frontend mock-data uses (see
/// <c>frontend/src/features/lookups/mock/lookups.mock.ts</c> lines 169–188)
/// so the smoke test returns realistic data.
///
/// In production the admin backend's <c>LookupsAdmin</c> module + a SQL
/// migration own the seed — this helper is only wired when
/// <c>UseInMemoryDatabase=true</c> in <c>appsettings.Development.json</c>.
/// </summary>
public static class LookupsDevSeeder
{
    public static void SeedFacultiesIfEmpty(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LookupsReadDbContext>();

        if (db.FacultiesSet.Any()) return;

        foreach (var (code, name) in Seed)
        {
            db.FacultiesSet.Add(Faculty.Create(code, name));
        }
        db.SaveChanges();
    }

    /// <summary>
    /// 18 faculties verbatim from
    /// <c>frontend/src/features/lookups/mock/lookups.mock.ts</c>.
    /// </summary>
    private static readonly (string Code, string Name)[] Seed =
    [
        ("FAC-01", "الطب البشري"),
        ("FAC-02", "الصيدلة الإكلينيكية"),
        ("FAC-03", "الطب البيطري"),
        ("FAC-04", "التمريض"),
        ("FAC-05", "الهندسة"),
        ("FAC-06", "الحاسبات والمعلومات"),
        ("FAC-07", "التجارة"),
        ("FAC-08", "الزراعة"),
        ("FAC-09", "التربية الموسيقية"),
        ("FAC-10", "الفنون التطبيقية"),
        ("FAC-11", "الفنون الجميلة"),
        ("FAC-12", "العلوم"),
        ("FAC-13", "الاقتصاد والعلوم السياسية"),
        ("FAC-14", "الآداب"),
        ("FAC-15", "التربية"),
        ("FAC-16", "اللغات"),
        ("FAC-17", "الحقوق"),
        ("FAC-18", "التربية الرياضية"),
    ];
}
