using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PACademy.Admin.Api.Controllers;
using PACademy.Admin.Api.Modules.AdminRecords;
using PACademy.Admin.Api.Modules.Admissions.Eligibility;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Audit;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantsControllerTests
{
    [Fact]
    public async Task EligibleCategoriesReturnsConflictWhenNoActiveCycleExists()
    {
        await using var db = CreateDb();
        var controller = CreateController(db);

        var response = await controller.EligibleCategories("30001010123457", CancellationToken.None);

        var result = Assert.IsType<ConflictObjectResult>(response.Result);
        var envelope = Assert.IsType<ApiErrorEnvelope>(result.Value);
        Assert.Equal(ErrorCodes.Conflict, envelope.Code);
        Assert.Equal(ErrorCodes.NoActiveCycle, envelope.ConflictCode);
        Assert.Equal("لا توجد دورة قبول نشطة حالياً", envelope.Message);
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }

    private static ApplicantsController CreateController(AdminDbContext db)
    {
        var records = new AdminRecordsService(db, new HttpContextAccessor(), new NullAuditSink());
        var eligibility = new ApplicantEligibilityService(db, new MemoryCache(new MemoryCacheOptions()), records);
        return new ApplicantsController(records, eligibility)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }
}
