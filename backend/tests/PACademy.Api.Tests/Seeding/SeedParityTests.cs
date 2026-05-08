using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Infrastructure.Persistence;
using PACademy.Infrastructure.Seeding;
using PACademy.Api.Tests.Fixtures;
using Testcontainers.MsSql;

namespace PACademy.Api.Tests.Seeding;

/// <summary>
/// Parity tests asserting JS-LCG ≡ C#-LCG after seeding.
/// Catches drift in the deterministic seed port.
/// </summary>
[Collection("SqlServer")]
public sealed class SeedParityTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: true);
        await _factory.InitializeAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Seed_Produces240Applicants()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var count = await db.Applicants.CountAsync(a => a.DemoOrigin);
        count.Should().Be(240);
    }

    [Fact]
    public async Task Seed_AllApplicantsHaveValidNationalIds()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var nationalIds = await db.Applicants
            .Where(a => a.DemoOrigin)
            .Select(a => a.NationalId)
            .ToListAsync();

        nationalIds.Should().AllSatisfy(nid =>
        {
            nid.Should().HaveLength(14);
            nid.Should().MatchRegex(@"^\d{14}$");
        });
    }

    [Fact]
    public async Task Seed_Produces11RbacRoleUsers()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var roles = await db.Users
            .Where(u => u.DemoOrigin)
            .Select(u => u.Role)
            .ToListAsync();

        var expectedRoles = new[]
        {
            "super_admin", "committee_admin", "committee_user", "medical_admin",
            "medical_doctor", "investigator", "board_admin", "exams_admin",
            "biometric_user", "records_clerk", "applicant",
        };

        roles.Should().Contain(expectedRoles);
    }

    [Fact]
    public async Task Seed_AllSystemUsersHaveRequiredFr029Fields()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var users = await db.Users
            .Where(u => u.DemoOrigin)
            .ToListAsync();

        users.Should().AllSatisfy(u =>
        {
            u.OfficerCode.Should().NotBeNullOrEmpty();
            u.FullName.Should().NotBeNullOrEmpty();
            u.Mobile.Should().NotBeNullOrEmpty().And.MatchRegex(@"^(010|011|012|015)\d{8}$");
            u.Email.Should().NotBeNullOrEmpty();
            u.IssueDate.Should().BeBefore(DateTime.UtcNow.AddDays(1));
            u.CardFactoryNumber.Should().NotBeNullOrEmpty();
            u.IsActive.Should().BeTrue();
            u.DemoOrigin.Should().BeTrue();
        });
    }

    [Fact]
    public async Task Seed_Produces80AuditEntries()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var count = await db.AuditEntries.CountAsync(a => a.DemoOrigin);
        count.Should().Be(80);
    }

    [Fact]
    public async Task Seed_ProducesActiveCycle2026()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();

        var activeCycles = await db.Cycles
            .Where(c => c.DemoOrigin && c.Status == PACademy.Domain.Cycles.CycleStatus.Active)
            .ToListAsync();

        activeCycles.Should().HaveCount(1);
        activeCycles[0].Name.Should().Contain("2026");
    }

    [Fact]
    public async Task Seed_IsIdempotent()
    {
        // Running seed twice should not duplicate data
        using var scope = _factory.Services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<DemoDataSeeder>();
        await seeder.SeedAsync(CancellationToken.None);

        var db = scope.ServiceProvider.GetRequiredService<PaDbContext>();
        var count = await db.Applicants.CountAsync(a => a.DemoOrigin);
        count.Should().Be(240);
    }
}

[CollectionDefinition("SqlServer")]
public sealed class SqlServerCollection : ICollectionFixture<SqlServerFixture> { }
