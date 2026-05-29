using Microsoft.EntityFrameworkCore;
using PACademy.Modules.ApplicantGradesAdmin.Infrastructure;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantGradesAdminSeederTests
{
    [Fact]
    public async Task SeedDemoRowsCreatesCanonicalMoiApplicantGrade()
    {
        await using var db = CreateDb();

        await ApplicantGradesAdminSeeder.SeedDemoRowsAsync(db, CancellationToken.None);

        var row = await db.ApplicantGrades.SingleAsync(x => x.Nid == "30412180103456", TestContext.Current.CancellationToken);
        Assert.Equal(142018, row.Seat);
        Assert.Equal("أحمد محمد إبراهيم سعد", row.Name);
        Assert.Equal("SCH-01", row.SchoolCategoryCode);
        Assert.Equal(2026, row.GraduationYear);
        Assert.Equal(392m, row.Total);
        Assert.Equal(410m, row.ImportMax);
    }

    private static ApplicantGradesAdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicantGradesAdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new ApplicantGradesAdminDbContext(options);
    }
}
