using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.OperationalRecords;
using PACademy.Admin.Api.Persistence;

namespace PACademy.Admin.Api.Tests;

/// <summary>
/// The legacy JSON buckets stopped receiving rows for normalized modules
/// after the Normalize* migration wave — a raw-store read of one of those
/// modules silently returns a frozen snapshot (the «غير مسجل» committee-name
/// bug, 2026-06-10). These tests pin the guard that turns that mistake into
/// a loud failure on relational providers while leaving the in-memory test
/// path (where the store is the only storage) untouched.
/// </summary>
public sealed class OperationalRecordStoreGuardTests
{
    [Theory]
    [InlineData("committeeInstances")]
    [InlineData("committees")]
    [InlineData("applicants")]
    [InlineData("grades")]
    [InlineData("payments")]
    [InlineData("workflows")]
    public void StaleAccessIsBlockedForNormalizedModulesOnRelational(string module)
    {
        Assert.True(OperationalRecordStore.IsStaleNormalizedModuleAccess(
            module, isRelational: true, allowNormalizedModule: false));
    }

    [Theory]
    [InlineData("exam-attempts")]
    [InlineData("exam-audit")]
    [InlineData("exam-live-sessions")]
    [InlineData("kpis")]
    [InlineData("relatives")]
    public void DocumentShapedModulesStayAccessible(string module)
    {
        Assert.False(OperationalRecordStore.IsStaleNormalizedModuleAccess(
            module, isRelational: true, allowNormalizedModule: false));
    }

    [Fact]
    public void DeliberateLegacyFallbackIsAllowed()
    {
        Assert.False(OperationalRecordStore.IsStaleNormalizedModuleAccess(
            "committeeInstances", isRelational: true, allowNormalizedModule: true));
    }

    [Fact]
    public void NonRelationalProvidersAreNeverBlocked()
    {
        Assert.False(OperationalRecordStore.IsStaleNormalizedModuleAccess(
            "committeeInstances", isRelational: false, allowNormalizedModule: false));
    }

    [Fact]
    public async Task InMemoryStoreServesNormalizedModulesUnguarded()
    {
        await using var db = CreateDb();
        var store = new OperationalRecordStore(db);

        await store.UpsertAsync(
            "committeeInstances",
            "CI-test",
            new JsonObject { ["id"] = "CI-test", ["categoryKey"] = "law_bachelor" },
            TestContext.Current.CancellationToken);
        var rows = await store.ListAsync("committeeInstances", TestContext.Current.CancellationToken);

        Assert.Single(rows);
        Assert.Equal("law_bachelor", rows[0]["categoryKey"]?.GetValue<string>());
    }

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }
}
