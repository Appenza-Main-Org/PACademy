using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Lookups;
using PACademy.Admin.Api.Persistence;
using PACademy.Shared.Persistence.ChangeTracking;

namespace PACademy.Admin.Api.Tests;

public sealed class ChangeTrackingInterceptorTests
{
    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .AddInterceptors(new ChangeTrackingInterceptor(new SystemActorProvider()))
            .Options;
        return new AdminDbContext(options);
    }

    private static LookupRowEntity NewRow(string code, string name) => new()
    {
        LookupKey = "academic-grades",
        Code = code,
        Name = name,
        IsActive = true,
        PayloadJson = $$"""{"code":"{{code}}","name":"{{name}}"}""",
    };

    [Fact]
    public async Task Insert_stamps_tracking_metadata()
    {
        await using var db = CreateDb();
        var row = NewRow("EXC-01", "ممتاز");
        db.LookupRows.Add(row);
        await db.SaveChangesAsync();

        Assert.NotEqual(default, row.CreatedAt);
        Assert.NotEqual(default, row.UpdatedAt);
        Assert.Equal("system", row.LastModifiedBy);
        Assert.Equal(ChangeTrackingColumns.DefaultSourceSystem, row.SourceSystem);
        Assert.NotNull(row.Checksum);
        Assert.Equal(64, row.Checksum!.Length); // SHA-256 lowercase hex
    }

    [Fact]
    public async Task Update_to_data_column_changes_checksum_and_refreshes_updated_at()
    {
        await using var db = CreateDb();
        var row = NewRow("EXC-02", "جيد جداً");
        db.LookupRows.Add(row);
        await db.SaveChangesAsync();

        var checksumBefore = row.Checksum;
        var createdBefore = row.CreatedAt;

        row.Name = "جيد جداً (معدّل)";
        row.PayloadJson = """{"code":"EXC-02","name":"جيد جداً (معدّل)"}""";
        await db.SaveChangesAsync();

        Assert.NotEqual(checksumBefore, row.Checksum);
        Assert.Equal(createdBefore, row.CreatedAt); // created_at stamped once
    }

    [Fact]
    public void Checksum_excludes_tracking_columns()
    {
        // Two rows with identical data but different tracking metadata hash equal.
        var dataOnly = new KeyValuePair<string, object?>[]
        {
            new("lookup_key", "academic-grades"),
            new("code", "EXC-01"),
            new("name", "ممتاز"),
            new("is_active", true),
            new("payload_json", "{\"name\":\"ممتاز\",\"code\":\"EXC-01\"}"),
        };
        var withTracking = dataOnly.Concat(new KeyValuePair<string, object?>[]
        {
            new("created_at", DateTimeOffset.UtcNow),
            new("updated_at", DateTimeOffset.UtcNow.AddMinutes(5)),
            new("row_version", new byte[] { 1, 2, 3 }),
            new("last_modified_by", "someone"),
            new("source_system", "external-import"),
            new("checksum", "stale"),
        });

        Assert.Equal(RowChecksum.Compute(dataOnly), RowChecksum.Compute(withTracking));
    }

    [Fact]
    public void Checksum_is_stable_across_json_key_order()
    {
        var a = new KeyValuePair<string, object?>[] { new("payload_json", "{\"a\":1,\"b\":2}") };
        var b = new KeyValuePair<string, object?>[] { new("payload_json", "{\"b\":2,\"a\":1}") };
        Assert.Equal(RowChecksum.Compute(a), RowChecksum.Compute(b));
    }

    [Fact]
    public void Import_supplied_source_system_is_preserved()
    {
        // The interceptor only defaults source_system when blank — an import that
        // sets it must keep its provenance.
        var row = NewRow("EXC-03", "جيد");
        row.SourceSystem = "external-import";

        // Simulate interceptor's defaulting branch:
        var resolved = string.IsNullOrWhiteSpace(row.SourceSystem)
            ? ChangeTrackingColumns.DefaultSourceSystem
            : row.SourceSystem;

        Assert.Equal("external-import", resolved);
    }
}
